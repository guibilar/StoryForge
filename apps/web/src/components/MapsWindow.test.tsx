import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { useMutation, useQuery, useSubscription } from "urql";

import { MapsWindow } from "./MapsWindow";
import { useDesktopWindows } from "../lib/DesktopWindowsContext";
import { useOpenEntityWindow } from "../hooks/useOpenEntityWindow";
import { WindowChromeContext } from "../lib/WindowChromeContext";
import {
  CampaignDocument,
  CreateMarkerDocument,
  CreateTerritoryDocument,
  DeleteMapImageDocument,
  DeleteMarkerDocument,
  ForceSyncViewportDocument,
  MapImageDocument,
  MarkersDocument,
  MeDocument,
  OnForceSyncViewportDocument,
  TerritoriesDocument,
  UploadMapImageDocument,
} from "../gql/graphql";
import type { MapCanvasProps } from "./MapCanvas";
import { createDesktopWindowsStub } from "../lib/desktopWindowsStub";

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
      <span data-testid="editing">{String(props.editing)}</span>
      {props.onEditingChange ? (
        <button onClick={() => props.onEditingChange?.(!props.editing)}>
          {props.editing ? "Done editing" : "Edit map"}
        </button>
      ) : null}
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
      {props.onCompleteTerritory ? (
        <button
          onClick={() =>
            props.onCompleteTerritory?.({
              type: "Polygon",
              coordinates: [
                [
                  [0, 0],
                  [1, 0],
                  [1, 1],
                  [0, 0],
                ],
              ],
            })
          }
        >
          Complete territory
        </button>
      ) : null}
      {props.onViewportChange ? (
        <button
          onClick={() =>
            props.onViewportChange?.({
              center: { lat: 10.5, lng: 20.25 },
              zoom: 7,
            })
          }
        >
          Report viewport
        </button>
      ) : null}
      <span data-testid="applied-viewport">
        {props.viewport ? JSON.stringify(props.viewport) : ""}
      </span>
      {props.onOpenEntity && props.markers?.[0]?.entity ? (
        <button onClick={() => props.onOpenEntity?.(props.markers![0].entity!)}>
          Open linked entity
        </button>
      ) : null}
    </div>
  ),
}));

vi.mock("../hooks/useOpenEntityWindow", () => ({
  useOpenEntityWindow: vi.fn(),
}));

vi.mock("urql", async (importOriginal) => {
  const actual = await importOriginal<typeof import("urql")>();
  return {
    ...actual,
    useMutation: vi.fn(),
    useQuery: vi.fn(),
    useSubscription: vi.fn(),
  };
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

// A writer (Storyteller) alongside a couple of PLAYER/OBSERVER members —
// what the broadcast-target picker's dropdown should offer.
const ownerWithPlayersMembers = [
  ...ownerMembers,
  {
    userId: "user-2",
    role: "PLAYER",
    user: { id: "user-2", email: "player-two@example.com" },
  },
  {
    userId: "user-3",
    role: "OBSERVER",
    user: { id: "user-3", email: "observer@example.com" },
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

// Manual-coordinate entry ("Add Marker"/"Add Territory") only appears on
// a custom map image, so tests that exercise it have to set one.
const imageMap = {
  id: "map-image-1",
  url: "/uploads/camp-1/map.png",
  fileName: "map.png",
  width: 2000,
  height: 1500,
};

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
  forceSyncViewport = vi
    .fn()
    .mockResolvedValue({ data: { forceSyncViewport: true } }),
  reexecuteMarkers = vi.fn(),
  reexecuteTerritories = vi.fn(),
  reexecuteMapImage = vi.fn(),
  deleteMarkerFetching = false,
  deleteMarkerError = undefined as { graphQLErrors: unknown[] } | undefined,
  deleteMapImageFetching = false,
  deleteMapImageError = undefined as { graphQLErrors: unknown[] } | undefined,
  forceSyncViewportFetching = false,
  forceSyncViewportError = undefined as
    { graphQLErrors: unknown[] } | undefined,
  markersFetching = false,
  markersLoaded = true,
  syncEvent = undefined as
    | {
        campaignId: string;
        center: { lat: number; lng: number };
        zoom: number;
        broadcasterId: string;
      }
    | undefined,
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
        {
          data: markersLoaded ? { markers: markerList } : undefined,
          fetching: markersFetching,
          stale: false,
        },
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

    if (document === ForceSyncViewportDocument) {
      return [
        {
          fetching: forceSyncViewportFetching,
          error: forceSyncViewportError,
          stale: false,
        },
        forceSyncViewport,
      ];
    }

    // Only exercised once the export/import modal (KAN-136) is opened.
    if (document === CreateMarkerDocument) {
      return [
        { fetching: false, error: undefined, stale: false },
        vi.fn().mockResolvedValue({ data: { createMarker: { id: "m" } } }),
      ];
    }

    if (document === CreateTerritoryDocument) {
      return [
        { fetching: false, error: undefined, stale: false },
        vi.fn().mockResolvedValue({ data: { createTerritory: { id: "t" } } }),
      ];
    }

    throw new Error("Unexpected mutation in test");
  }) as never);

  // Computed once per setupMocks() call rather than inside the
  // mockImplementation closure below: a real urql `useSubscription` only
  // hands back a new `data` object reference when a genuinely new message
  // arrives, not on every unrelated re-render. Rebuilding the wrapper object
  // on every invocation would make MapsWindow's `useEffect(..., [syncEventData])`
  // see a "new" value on every render and loop forever.
  const syncSubscriptionData = syncEvent
    ? { forceSyncViewport: syncEvent }
    : undefined;
  vi.mocked(useSubscription).mockImplementation(((args: { query: unknown }) => {
    if (args.query === OnForceSyncViewportDocument) {
      return [
        {
          data: syncSubscriptionData,
          fetching: false,
          stale: false,
        },
        vi.fn(),
      ];
    }

    throw new Error("Unexpected subscription in test");
  }) as never);

  return {
    deleteMarker,
    uploadMapImage,
    deleteMapImage,
    forceSyncViewport,
    reexecuteMarkers,
    reexecuteTerritories,
    reexecuteMapImage,
  };
}

function setupDesktopWindows() {
  const openWindow = vi.fn();
  vi.mocked(useDesktopWindows).mockReturnValue(
    createDesktopWindowsStub({ openWindow }),
  );
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

  it("shows Add Marker/Add Territory controls for an Owner on an image map", async () => {
    setupMocks({ mapImage: imageMap });
    setupDesktopWindows();
    const user = userEvent.setup();
    renderWindow();

    // Edit affordances are opt-in now — enter edit mode first.
    await user.click(screen.getByRole("button", { name: "Edit map" }));

    expect(
      screen.getByRole("button", { name: "Add Marker" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Add Territory" }),
    ).toBeInTheDocument();
  });

  it("keeps the canvas mounted while refetching so the viewport survives", () => {
    // A save triggers a network-only refetch with data already in hand.
    // Swapping in a loading placeholder here would unmount Leaflet and
    // rebuild the map at its default center/zoom, losing wherever the user
    // had panned to.
    setupMocks({ markersFetching: true });
    setupDesktopWindows();
    renderWindow();

    expect(screen.getByTestId("map-canvas")).toBeInTheDocument();
    expect(screen.queryByText("Loading map…")).not.toBeInTheDocument();
  });

  it("blocks on the very first load, before any data has arrived", () => {
    setupMocks({ markersFetching: true, markersLoaded: false });
    setupDesktopWindows();
    renderWindow();

    expect(screen.getByText("Loading map…")).toBeInTheDocument();
  });

  it("hides manual-coordinate entry on the geographic tile layer", () => {
    setupMocks({ mapImage: null });
    setupDesktopWindows();
    renderWindow();

    // Typing lat/lng by hand has no place on a tile map — drawing on the
    // canvas is the way in. Upload stays, or there'd be no way to add an
    // image in the first place.
    expect(
      screen.queryByRole("button", { name: "Add Marker" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Add Territory" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Upload Map Image" }),
    ).toBeInTheDocument();
  });

  it("hides write controls for a Player (read-only)", () => {
    setupMocks({ members: playerMembers, mapImage: imageMap });
    setupDesktopWindows();
    renderWindow();

    expect(
      screen.queryByRole("button", { name: "Add Marker" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Add Territory" }),
    ).not.toBeInTheDocument();
  });

  it("opens a create marker window when + Add Marker is clicked", async () => {
    setupMocks({ mapImage: imageMap });
    const { openWindow } = setupDesktopWindows();
    const user = userEvent.setup();
    renderWindow();

    // Edit affordances are opt-in now — enter edit mode first.
    await user.click(screen.getByRole("button", { name: "Edit map" }));

    await user.click(screen.getByRole("button", { name: "Add Marker" }));

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

  it("seeds the create territory form with the drawn geometry as a JSON string", async () => {
    setupMocks();
    const { openWindow } = setupDesktopWindows();
    const user = userEvent.setup();
    renderWindow();

    await user.click(
      screen.getByRole("button", { name: "Complete territory" }),
    );

    expect(screen.getByTestId("draw-mode")).toHaveTextContent("none");
    const request = openWindow.mock.calls[0][0] as {
      id: string;
      render: () => { props: { mode: { initial?: { geometry: string } } } };
    };
    expect(request.id).toBe("territory-form:new:1");

    // The form field and the wire both carry geometry as a string, not an
    // object — round-tripping it must give back what was drawn.
    const geometry = request.render().props.mode.initial?.geometry;
    expect(JSON.parse(geometry!)).toEqual({
      type: "Polygon",
      coordinates: [
        [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 0],
        ],
      ],
    });
  });

  it("opens an unseeded create territory window from the + Add Territory button", async () => {
    setupMocks({ mapImage: imageMap });
    const { openWindow } = setupDesktopWindows();
    const user = userEvent.setup();
    renderWindow();

    // Edit affordances are opt-in now — enter edit mode first.
    await user.click(screen.getByRole("button", { name: "Edit map" }));

    await user.click(screen.getByRole("button", { name: "Add Territory" }));

    expect(openWindow).toHaveBeenCalledWith(
      expect.objectContaining({ id: "territory-form:new" }),
    );
  });

  it("opens an unseeded create marker window from the + Add Marker button", async () => {
    setupMocks({ mapImage: imageMap });
    const { openWindow } = setupDesktopWindows();
    const user = userEvent.setup();
    renderWindow();

    // Edit affordances are opt-in now — enter edit mode first.
    await user.click(screen.getByRole("button", { name: "Edit map" }));

    await user.click(screen.getByRole("button", { name: "Add Marker" }));

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
    setupMocks({ mapImage: imageMap });
    const { openWindow } = setupDesktopWindows();
    const user = userEvent.setup();
    renderWindow();

    // Edit affordances are opt-in now — enter edit mode first.
    await user.click(screen.getByRole("button", { name: "Edit map" }));

    await user.click(screen.getByRole("button", { name: "Add Territory" }));

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

  it("passes the linked entity's image and color through when opening it from a marker", async () => {
    const openEntityWindow = vi.fn();
    vi.mocked(useOpenEntityWindow).mockReturnValue(openEntityWindow);
    setupMocks({
      markerList: [
        {
          id: "marker-1",
          name: "Old Mill",
          lat: 1,
          lng: 2,
          description: null,
          entity: {
            id: "e-1",
            name: "Riverwood",
            type: "City",
            category: "LOCATION",
            description: "A quiet town.",
            image: "/uploads/e-1/portrait.png",
            color: "#4287f5",
            visibility: "PUBLIC",
          },
        },
      ] as never,
    });
    setupDesktopWindows();
    const user = userEvent.setup();
    renderWindow();

    await user.click(
      screen.getByRole("button", { name: "Open linked entity" }),
    );

    expect(openEntityWindow).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "e-1",
        image: "/uploads/e-1/portrait.png",
        color: "#4287f5",
        category: "LOCATION",
      }),
    );
  });

  it("opens an edit territory window when a territory is clicked (writer only)", async () => {
    setupMocks();
    const { openWindow } = setupDesktopWindows();
    const user = userEvent.setup();
    renderWindow();

    // Edit affordances are opt-in now — enter edit mode first.
    await user.click(screen.getByRole("button", { name: "Edit map" }));

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

  describe("KAN-136 map data export/import", () => {
    it("shows the export/import trigger for a writer on the geographic tile layer", () => {
      setupMocks({ mapImage: null });
      setupDesktopWindows();
      renderWindow();

      expect(
        screen.getByRole("button", { name: "Export or import map data" }),
      ).toBeInTheDocument();
    });

    it("hides the export/import trigger on a campaign with a custom map image", () => {
      setupMocks({ mapImage: imageMap });
      setupDesktopWindows();
      renderWindow();

      expect(
        screen.queryByRole("button", { name: "Export or import map data" }),
      ).not.toBeInTheDocument();
    });

    it("hides the export/import trigger for a Player (read-only)", () => {
      setupMocks({ members: playerMembers, mapImage: null });
      setupDesktopWindows();
      renderWindow();

      expect(
        screen.queryByRole("button", { name: "Export or import map data" }),
      ).not.toBeInTheDocument();
    });

    it("opens the export/import modal from the trigger button", async () => {
      setupMocks({ mapImage: null });
      setupDesktopWindows();
      const user = userEvent.setup();
      renderWindow();

      await user.click(
        screen.getByRole("button", { name: "Export or import map data" }),
      );

      expect(
        screen.getByRole("heading", { name: "Export / import map data" }),
      ).toBeInTheDocument();
    });
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

  describe("KAN-131 viewport sync", () => {
    it("hides the sync-to-players control for a Player (read-only)", () => {
      setupMocks({ members: playerMembers });
      setupDesktopWindows();
      renderWindow();

      expect(
        screen.queryByRole("button", { name: "Sync view to players" }),
      ).not.toBeInTheDocument();
    });

    it("shows the sync-to-players control for a Storyteller-tier writer", () => {
      setupMocks({ members: ownerWithPlayersMembers });
      setupDesktopWindows();
      renderWindow();

      expect(
        screen.getByRole("button", { name: "Sync view to players" }),
      ).toBeInTheDocument();
    });

    it("disables the sync button until MapCanvas has reported a live viewport", () => {
      setupMocks({ members: ownerWithPlayersMembers });
      setupDesktopWindows();
      renderWindow();

      expect(
        screen.getByRole("button", { name: "Sync view to players" }),
      ).toBeDisabled();
    });

    it("sends forceSyncViewport with the live viewport and an 'all players' target by default", async () => {
      const { forceSyncViewport } = setupMocks({
        members: ownerWithPlayersMembers,
      });
      setupDesktopWindows();
      const user = userEvent.setup();
      renderWindow();

      // MapCanvas is stubbed — this button stands in for its real
      // onViewportChange firing on mount/pan/zoom (KAN-130).
      await user.click(screen.getByRole("button", { name: "Report viewport" }));
      await user.click(
        screen.getByRole("button", { name: "Sync view to players" }),
      );

      expect(forceSyncViewport).toHaveBeenCalledWith({
        input: {
          campaignId: "camp-1",
          center: { lat: 10.5, lng: 20.25 },
          zoom: 7,
          target: { allPlayers: true, userIds: [] },
        },
      });
    });

    it("sends forceSyncViewport targeted at a single selected player", async () => {
      const { forceSyncViewport } = setupMocks({
        members: ownerWithPlayersMembers,
      });
      setupDesktopWindows();
      const user = userEvent.setup();
      renderWindow();

      await user.click(screen.getByRole("button", { name: "Report viewport" }));
      await user.selectOptions(
        screen.getByRole("combobox", { name: "Sync view target" }),
        "player-two@example.com",
      );
      await user.click(
        screen.getByRole("button", { name: "Sync view to players" }),
      );

      expect(forceSyncViewport).toHaveBeenCalledWith({
        input: {
          campaignId: "camp-1",
          center: { lat: 10.5, lng: 20.25 },
          zoom: 7,
          target: { allPlayers: false, userIds: ["user-2"] },
        },
      });
    });

    it("shows a success message once forceSyncViewport resolves", async () => {
      setupMocks({ members: ownerWithPlayersMembers });
      setupDesktopWindows();
      const user = userEvent.setup();
      renderWindow();

      await user.click(screen.getByRole("button", { name: "Report viewport" }));
      await user.click(
        screen.getByRole("button", { name: "Sync view to players" }),
      );

      expect(screen.getByText("Viewport synced.")).toBeInTheDocument();
    });

    it("surfaces an error when forceSyncViewport fails", async () => {
      setupMocks({
        members: ownerWithPlayersMembers,
        forceSyncViewport: vi.fn().mockResolvedValue({ data: undefined }),
        forceSyncViewportError: {
          graphQLErrors: [{ message: "You are not allowed to do that." }],
        } as never,
      });
      setupDesktopWindows();
      const user = userEvent.setup();
      renderWindow();

      await user.click(screen.getByRole("button", { name: "Report viewport" }));
      await user.click(
        screen.getByRole("button", { name: "Sync view to players" }),
      );

      expect(
        screen.getByText("You are not allowed to do that."),
      ).toBeInTheDocument();
    });

    it("applies an inbound forceSyncViewport subscription payload to MapCanvas's viewport prop, for any role", () => {
      setupMocks({
        members: playerMembers,
        syncEvent: {
          campaignId: "camp-1",
          center: { lat: 33.3, lng: -12.1 },
          zoom: 9,
          broadcasterId: "user-1",
        },
      });
      setupDesktopWindows();
      renderWindow();

      expect(screen.getByTestId("applied-viewport")).toHaveTextContent(
        JSON.stringify({ center: { lat: 33.3, lng: -12.1 }, zoom: 9 }),
      );
    });

    it("does not push anything into MapCanvas's viewport prop when no sync event has arrived", () => {
      setupMocks({ members: playerMembers });
      setupDesktopWindows();
      renderWindow();

      expect(screen.getByTestId("applied-viewport")).toHaveTextContent("");
    });
  });
});
