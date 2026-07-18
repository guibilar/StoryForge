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
  DeleteMarkerDocument,
  MarkersDocument,
  MeDocument,
  TerritoriesDocument,
} from "../gql/graphql";
import type { MapCanvasProps } from "./MapCanvas";

// MapCanvas has its own dedicated tests (real Leaflet rendering); here we
// only need to verify MapsWindow wires data/callbacks into it correctly, so
// stub it with buttons that expose each prop directly.
vi.mock("./MapCanvas", () => ({
  MapCanvas: (props: MapCanvasProps) => (
    <div data-testid="map-canvas">
      {(props.markers ?? []).map((marker) => (
        <div key={marker.id}>
          <span>{marker.name}</span>
          <button onClick={() => props.onEditMarker?.(marker)}>
            Edit marker {marker.name}
          </button>
          <button onClick={() => props.onDeleteMarker?.(marker)}>
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
  deleteMarker = vi.fn().mockResolvedValue({ data: { deleteMarker: true } }),
  reexecuteMarkers = vi.fn(),
  reexecuteTerritories = vi.fn(),
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

    throw new Error("Unexpected query in test");
  }) as never);

  vi.mocked(useMutation).mockImplementation(((document: unknown) => {
    if (document === DeleteMarkerDocument) {
      return [
        { fetching: false, error: undefined, stale: false },
        deleteMarker,
      ];
    }

    throw new Error("Unexpected mutation in test");
  }) as never);

  return { deleteMarker, reexecuteMarkers, reexecuteTerritories };
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
});
