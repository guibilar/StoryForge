import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { useMutation, useQuery } from "urql";

import { MapsWindow } from "./MapsWindow";
import { useDesktopWindows } from "../lib/DesktopWindowsContext";
import { WindowChromeContext } from "../lib/WindowChromeContext";
import {
  CampaignDocument,
  DeleteMapImageDocument,
  DeleteMarkerDocument,
  MapImageDocument,
  MarkersDocument,
  MeDocument,
  TerritoriesDocument,
  UploadMapImageDocument,
} from "../gql/graphql";
import type { MapCanvasProps } from "./MapCanvas";

// MapCanvas has its own dedicated tests (real Leaflet rendering); here we
// only need to verify MapsWindow wires data/callbacks into it correctly, so
// stub it with buttons that expose each prop directly.
vi.mock("./MapCanvas", () => ({
  MapCanvas: (props: MapCanvasProps) => (
    <div data-testid="map-canvas">
      {props.imageOverlay ? (
        <span data-testid="image-overlay-url">{props.imageOverlay.url}</span>
      ) : null}
      {(props.markers ?? []).map((marker) => (
        <div key={marker.id}>
          <span>{marker.name}</span>
          <button
            disabled={props.markerActionPending}
            onClick={() => props.onEditMarker?.(marker)}
          >
            Edit marker {marker.name}
          </button>
          <button
            disabled={props.markerActionPending}
            onClick={() => props.onDeleteMarker?.(marker)}
          >
            Delete marker {marker.name}
          </button>
        </div>
      ))}
      {(props.territories ?? []).map((territory) => (
        <button
          key={territory.id}
          onClick={() => props.onTerritoryClick?.(territory)}
        >
          Territory {territory.name}
        </button>
      ))}
      <span data-testid="draw-mode">{props.drawMode}</span>
      {props.onDrawModeChange ? (
        <button onClick={() => props.onDrawModeChange?.("marker")}>
          Arm marker mode
        </button>
      ) : null}
      {props.onPlaceMarker ? (
        <button
          onClick={() =>
            props.onPlaceMarker?.({ lat: 51.5051234567, lng: -0.0901234567 })
          }
        >
          Place marker
        </button>
      ) : null}
    </div>
  ),
}));

vi.mock("urql", async (importOriginal) => {
  const actual = await importOriginal<typeof import("urql")>();
  return { ...actual, useMutation: vi.fn(), useQuery: vi.fn() };
});

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useParams: () => ({ id: "camp-1" }) };
});

vi.mock("../lib/DesktopWindowsContext", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../lib/DesktopWindowsContext")>();
  return { ...actual, useDesktopWindows: vi.fn() };
});

const CURRENT_USER_ID = "user-1";

const ownerMembers = [
  {
    userId: CURRENT_USER_ID,
    role: "OWNER",
    user: { id: CURRENT_USER_ID, email: "owner@example.com" },
  },
];

const playerMembers = [
  {
    userId: CURRENT_USER_ID,
    role: "PLAYER",
    user: { id: CURRENT_USER_ID, email: "player@example.com" },
  },
];

const markers = [
  { id: "marker-1", name: "Old Mill", lat: 1, lng: 2, description: null },
];

const territories = [
  {
    id: "territory-1",
    name: "Thornwood",
    type: "region",
    geometry: JSON.stringify({ type: "Polygon", coordinates: [] }),
    description: null,
  },
];

function setupMocks({
  members = ownerMembers,
  markerList = markers,
  territoryList = territories,
  mapImage = null as {
    id: string;
    url: string;
    fileName: string;
    width: number;
    height: number;
  } | null,
  deleteMarker = vi.fn().mockResolvedValue({ data: { deleteMarker: true } }),
  uploadMapImage = vi
    .fn()
    .mockResolvedValue({ data: { uploadMapImage: { id: "map-image-1" } } }),
  deleteMapImage = vi
    .fn()
    .mockResolvedValue({ data: { deleteMapImage: true } }),
  reexecuteMarkers = vi.fn(),
  reexecuteTerritories = vi.fn(),
  reexecuteMapImage = vi.fn(),
  deleteMarkerFetching = false,
  deleteMarkerError = undefined as { graphQLErrors: unknown[] } | undefined,
  deleteMapImageFetching = false,
  deleteMapImageError = undefined as { graphQLErrors: unknown[] } | undefined,
} = {}) {
  vi.mocked(useQuery).mockImplementation(((args: { query: unknown }) => {
    if (args.query === MeDocument) {
      return [
        {
          data: { me: { id: CURRENT_USER_ID, email: "member@example.com" } },
          fetching: false,
          stale: false,
        },
        vi.fn(),
      ];
    }

    if (args.query === CampaignDocument) {
      return [
        {
          data: { campaign: { id: "camp-1", name: "Campaign", members } },
          fetching: false,
          stale: false,
        },
        vi.fn(),
      ];
    }

    if (args.query === MarkersDocument) {
      return [
        { data: { markers: markerList }, fetching: false, stale: false },
        reexecuteMarkers,
      ];
    }

    if (args.query === TerritoriesDocument) {
      return [
        {
          data: { territories: territoryList },
          fetching: false,
          stale: false,
        },
        reexecuteTerritories,
      ];
    }

    if (args.query === MapImageDocument) {
      return [
        { data: { mapImage }, fetching: false, stale: false },
        reexecuteMapImage,
      ];
    }

    throw new Error("Unexpected query in test");
  }) as never);

  vi.mocked(useMutation).mockImplementation(((document: unknown) => {
    if (document === DeleteMarkerDocument) {
      return [
        {
          fetching: deleteMarkerFetching,
          error: deleteMarkerError,
          stale: false,
        },
        deleteMarker,
      ];
    }

    if (document === UploadMapImageDocument) {
      return [
        { fetching: false, error: undefined, stale: false },
        uploadMapImage,
      ];
    }

    if (document === DeleteMapImageDocument) {
      return [
        {
          fetching: deleteMapImageFetching,
          error: deleteMapImageError,
          stale: false,
        },
        deleteMapImage,
      ];
    }

    throw new Error("Unexpected mutation in test");
  }) as never);

  return {
    deleteMarker,
    uploadMapImage,
    deleteMapImage,
    reexecuteMarkers,
    reexecuteTerritories,
    reexecuteMapImage,
  };
}

function setupDesktopWindows() {
  const openWindow = vi.fn();
  vi.mocked(useDesktopWindows).mockReturnValue({
    layout: {},
    bringToFront: vi.fn(),
    toggle: vi.fn(),
    startDrag: vi.fn(),
    startResize: vi.fn(),
    reset: vi.fn(),
    dynamicWindows: {},
    openWindow,
    closeWindow: vi.fn(),
    recentIds: [],
    presets: {},
    savePreset: vi.fn(),
    applyPreset: vi.fn(),
    hydrateFromServer: vi.fn(),
  });
  return { openWindow };
}

function renderWindow() {
  const chromeApi = { setLoading: vi.fn(), setOnRefresh: vi.fn() };
  render(
    <WindowChromeContext.Provider value={chromeApi}>
      <MemoryRouter>
        <MapsWindow />
      </MemoryRouter>
    </WindowChromeContext.Provider>,
  );
  return chromeApi;
}

describe("MapsWindow", () => {
  it("renders the map canvas with markers and territories", () => {
    setupMocks();
    setupDesktopWindows();
    renderWindow();

    expect(screen.getByTestId("map-canvas")).toBeInTheDocument();
    expect(screen.getByText("Old Mill")).toBeInTheDocument();
    expect(screen.getByText("Territory Thornwood")).toBeInTheDocument();
  });

  it("shows Add Marker/Add Territory controls for an Owner", () => {
    setupMocks();
    setupDesktopWindows();
    renderWindow();

    expect(
      screen.getByRole("button", { name: "+ Add Marker" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "+ Add Territory" }),
    ).toBeInTheDocument();
  });

  it("hides write controls for a Player (read-only)", () => {
    setupMocks({ members: playerMembers });
    setupDesktopWindows();
    renderWindow();

    expect(
      screen.queryByRole("button", { name: "+ Add Marker" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "+ Add Territory" }),
    ).not.toBeInTheDocument();
  });

  it("opens a create marker window when + Add Marker is clicked", async () => {
    setupMocks();
    const { openWindow } = setupDesktopWindows();
    const user = userEvent.setup();
    renderWindow();

    await user.click(screen.getByRole("button", { name: "+ Add Marker" }));

    expect(openWindow).toHaveBeenCalledWith(
      expect.objectContaining({ id: "marker-form:new", title: "New Marker" }),
    );
  });

  it("gives the canvas draw-mode control for a writer", () => {
    setupMocks();
    setupDesktopWindows();
    renderWindow();

    expect(
      screen.getByRole("button", { name: "Arm marker mode" }),
    ).toBeInTheDocument();
  });

  it("withholds draw-mode control from a Player (read-only)", () => {
    setupMocks({ members: playerMembers });
    setupDesktopWindows();
    renderWindow();

    expect(
      screen.queryByRole("button", { name: "Arm marker mode" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Place marker" }),
    ).not.toBeInTheDocument();
  });

  it("tracks the armed draw mode and disarms it once a marker is placed", async () => {
    setupMocks();
    const { openWindow } = setupDesktopWindows();
    const user = userEvent.setup();
    renderWindow();

    expect(screen.getByTestId("draw-mode")).toHaveTextContent("none");

    await user.click(screen.getByRole("button", { name: "Arm marker mode" }));
    expect(screen.getByTestId("draw-mode")).toHaveTextContent("marker");

    await user.click(screen.getByRole("button", { name: "Place marker" }));

    expect(screen.getByTestId("draw-mode")).toHaveTextContent("none");
    expect(openWindow).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "marker-form:new:1@51.505123,-0.090123",
        title: "New Marker",
      }),
    );
  });

  it("gives each placement its own window even when the same spot is clicked twice", async () => {
    setupMocks();
    const { openWindow } = setupDesktopWindows();
    const user = userEvent.setup();
    renderWindow();

    const place = screen.getByRole("button", { name: "Place marker" });
    await user.click(place);
    await user.click(place);

    // Identical coordinates both times — without the counter these would
    // collide and the second form would replace the first, discarding
    // whatever had been typed into it.
    const ids = openWindow.mock.calls.map(
      (call) => (call[0] as { id: string }).id,
    );
    expect(ids).toEqual([
      "marker-form:new:1@51.505123,-0.090123",
      "marker-form:new:2@51.505123,-0.090123",
    ]);
  });

  it("seeds the create marker form with the clicked coordinates", async () => {
    setupMocks();
    const { openWindow } = setupDesktopWindows();
    const user = userEvent.setup();
    renderWindow();

    await user.click(screen.getByRole("button", { name: "Place marker" }));

    const request = openWindow.mock.calls[0][0] as {
      render: () => { props: { mode: { initial?: unknown } } };
    };
    expect(request.render().props.mode).toEqual({
      mode: "create",
      initial: { lat: 51.505123, lng: -0.090123 },
    });
  });

  it("opens an unseeded create marker window from the + Add Marker button", async () => {
    setupMocks();
    const { openWindow } = setupDesktopWindows();
    const user = userEvent.setup();
    renderWindow();

    await user.click(screen.getByRole("button", { name: "+ Add Marker" }));

    // The click handler must not leak its MouseEvent into the position
    // parameter — the id stays unsuffixed and nothing is prefilled.
    expect(openWindow).toHaveBeenCalledWith(
      expect.objectContaining({ id: "marker-form:new" }),
    );
    const request = openWindow.mock.calls[0][0] as {
      render: () => { props: { mode: { initial?: unknown } } };
    };
    expect(request.render().props.mode).toEqual({
      mode: "create",
      initial: undefined,
    });
  });

  it("opens a create territory window when + Add Territory is clicked", async () => {
    setupMocks();
    const { openWindow } = setupDesktopWindows();
    const user = userEvent.setup();
    renderWindow();

    await user.click(screen.getByRole("button", { name: "+ Add Territory" }));

    expect(openWindow).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "territory-form:new",
        title: "New Territory",
      }),
    );
  });

  it("opens an edit marker window when the marker's Edit callback fires", async () => {
    setupMocks();
    const { openWindow } = setupDesktopWindows();
    const user = userEvent.setup();
    renderWindow();

    await user.click(
      screen.getByRole("button", { name: "Edit marker Old Mill" }),
    );

    expect(openWindow).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "marker-form:marker-1",
        title: "Edit: Old Mill",
      }),
    );
  });

  it("deletes a marker and refetches when the marker's Delete callback fires", async () => {
    const { deleteMarker, reexecuteMarkers, reexecuteTerritories } =
      setupMocks();
    setupDesktopWindows();
    const user = userEvent.setup();
    renderWindow();

    await user.click(
      screen.getByRole("button", { name: "Delete marker Old Mill" }),
    );

    expect(deleteMarker).toHaveBeenCalledWith({ id: "marker-1" });
    expect(reexecuteMarkers).toHaveBeenCalledWith({
      requestPolicy: "network-only",
    });
    expect(reexecuteTerritories).toHaveBeenCalledWith({
      requestPolicy: "network-only",
    });
  });

  it("opens an edit territory window when a territory is clicked (writer only)", async () => {
    setupMocks();
    const { openWindow } = setupDesktopWindows();
    const user = userEvent.setup();
    renderWindow();

    await user.click(
      screen.getByRole("button", { name: "Territory Thornwood" }),
    );

    expect(openWindow).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "territory-form:territory-1",
        title: "Edit: Thornwood",
      }),
    );
  });

  it("reports its loading state and a network-only refresh to the window chrome", () => {
    const { reexecuteMarkers, reexecuteTerritories } = setupMocks();
    setupDesktopWindows();
    const chromeApi = renderWindow();

    expect(chromeApi.setLoading).toHaveBeenCalledWith(false);
    const registered = chromeApi.setOnRefresh.mock.calls.at(-1)?.[0]() as
      (() => void) | undefined;
    registered?.();

    expect(reexecuteMarkers).toHaveBeenCalledWith({
      requestPolicy: "network-only",
    });
    expect(reexecuteTerritories).toHaveBeenCalledWith({
      requestPolicy: "network-only",
    });
  });

  it("shows Upload Map Image (no Remove) when the campaign has no map image", () => {
    setupMocks();
    setupDesktopWindows();
    renderWindow();

    expect(
      screen.getByRole("button", { name: "Upload Map Image" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Remove Map Image" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("image-overlay-url")).not.toBeInTheDocument();
  });

  it("shows Replace/Remove and passes the image overlay to MapCanvas when set", () => {
    setupMocks({
      mapImage: {
        id: "map-image-1",
        url: "/uploads/camp-1/map.png",
        fileName: "map.png",
        width: 2000,
        height: 1500,
      },
    });
    setupDesktopWindows();
    renderWindow();

    expect(
      screen.getByRole("button", { name: "Replace Map Image" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Remove Map Image" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("image-overlay-url")).toHaveTextContent(
      "/uploads/camp-1/map.png",
    );
  });

  it("hides upload controls for a Player (read-only)", () => {
    setupMocks({ members: playerMembers });
    setupDesktopWindows();
    renderWindow();

    expect(
      screen.queryByRole("button", { name: "Upload Map Image" }),
    ).not.toBeInTheDocument();
  });

  it("uploads the selected file and refetches the map image", async () => {
    const { uploadMapImage, reexecuteMapImage } = setupMocks();
    setupDesktopWindows();
    const user = userEvent.setup();
    renderWindow();

    const file = new File(["fake-bytes"], "fantasy-map.png", {
      type: "image/png",
    });
    const input = document.querySelector('input[type="file"]');
    expect(input).toBeTruthy();

    await user.upload(input as HTMLInputElement, file);

    expect(uploadMapImage).toHaveBeenCalledWith({
      campaignId: "camp-1",
      file,
    });
    expect(reexecuteMapImage).toHaveBeenCalledWith({
      requestPolicy: "network-only",
    });
  });

  it("removes the map image and refetches when Remove Map Image is clicked", async () => {
    const { deleteMapImage, reexecuteMapImage } = setupMocks({
      mapImage: {
        id: "map-image-1",
        url: "/uploads/camp-1/map.png",
        fileName: "map.png",
        width: 2000,
        height: 1500,
      },
    });
    setupDesktopWindows();
    const user = userEvent.setup();
    renderWindow();

    await user.click(screen.getByRole("button", { name: "Remove Map Image" }));

    expect(deleteMapImage).toHaveBeenCalledWith({ campaignId: "camp-1" });
    expect(reexecuteMapImage).toHaveBeenCalledWith({
      requestPolicy: "network-only",
    });
  });

  it("rejects an oversized file client-side without calling uploadMapImage", async () => {
    const { uploadMapImage } = setupMocks();
    setupDesktopWindows();
    const user = userEvent.setup();
    renderWindow();

    const oversizedFile = new File(
      [new Uint8Array(6 * 1024 * 1024)],
      "huge-map.png",
      { type: "image/png" },
    );
    const input = document.querySelector('input[type="file"]');

    await user.upload(input as HTMLInputElement, oversizedFile);

    expect(
      screen.getByText("File size exceeds the maximum limit of 5MB."),
    ).toBeInTheDocument();
    expect(uploadMapImage).not.toHaveBeenCalled();
  });

  it("surfaces an error when deleting a marker fails, instead of failing silently", async () => {
    const { deleteMarker, reexecuteMarkers } = setupMocks({
      deleteMarker: vi.fn().mockResolvedValue({ data: undefined }),
      deleteMarkerError: {
        graphQLErrors: [{ message: "You are not allowed to do that." }],
      } as never,
    });
    setupDesktopWindows();
    const user = userEvent.setup();
    renderWindow();

    await user.click(
      screen.getByRole("button", { name: "Delete marker Old Mill" }),
    );

    expect(deleteMarker).toHaveBeenCalledWith({ id: "marker-1" });
    expect(
      screen.getByText("You are not allowed to do that."),
    ).toBeInTheDocument();
    expect(reexecuteMarkers).not.toHaveBeenCalled();
  });

  it("disables marker actions on the canvas while a delete is in flight", () => {
    setupMocks({ deleteMarkerFetching: true });
    setupDesktopWindows();
    renderWindow();

    expect(
      screen.getByRole("button", { name: "Delete marker Old Mill" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Edit marker Old Mill" }),
    ).toBeDisabled();
  });

  it("surfaces an error when removing the map image fails, instead of failing silently", async () => {
    const { deleteMapImage, reexecuteMapImage } = setupMocks({
      mapImage: {
        id: "map-image-1",
        url: "/uploads/camp-1/map.png",
        fileName: "map.png",
        width: 2000,
        height: 1500,
      },
      deleteMapImage: vi.fn().mockResolvedValue({ data: undefined }),
      deleteMapImageError: {
        graphQLErrors: [{ message: "Map image not found." }],
      } as never,
    });
    setupDesktopWindows();
    const user = userEvent.setup();
    renderWindow();

    await user.click(screen.getByRole("button", { name: "Remove Map Image" }));

    expect(deleteMapImage).toHaveBeenCalledWith({ campaignId: "camp-1" });
    expect(screen.getByText("Map image not found.")).toBeInTheDocument();
    expect(reexecuteMapImage).not.toHaveBeenCalled();
  });

  it("disables Remove Map Image while a removal is in flight", () => {
    setupMocks({
      mapImage: {
        id: "map-image-1",
        url: "/uploads/camp-1/map.png",
        fileName: "map.png",
        width: 2000,
        height: 1500,
      },
      deleteMapImageFetching: true,
    });
    setupDesktopWindows();
    renderWindow();

    expect(
      screen.getByRole("button", { name: "Remove Map Image" }),
    ).toBeDisabled();
  });

  it("skips a territory with malformed geometry JSON instead of crashing", () => {
    setupMocks({
      territoryList: [
        ...territories,
        {
          id: "territory-bad",
          name: "Corrupted",
          type: "region",
          geometry: "{not-json",
          description: null,
        },
      ],
    });
    setupDesktopWindows();

    expect(() => renderWindow()).not.toThrow();
    expect(screen.getByText("Territory Thornwood")).toBeInTheDocument();
    expect(screen.queryByText("Territory Corrupted")).not.toBeInTheDocument();
  });
});
