import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useQuery } from "urql";

import { RelationshipGraphWindow } from "./RelationshipGraphWindow";
import { useDesktopWindows } from "../lib/DesktopWindowsContext";
import { WindowChromeContext } from "../lib/WindowChromeContext";
import {
  CampaignDocument,
  EntitiesDocument,
  MeDocument,
  RelationshipsDocument,
} from "../gql/graphql";

vi.mock("urql", async (importOriginal) => {
  const actual = await importOriginal<typeof import("urql")>();
  return { ...actual, useQuery: vi.fn() };
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

// @xyflow/react measures each node via a ResizeObserver callback and reads
// its geometry via getBoundingClientRect/offsetWidth (all no-ops in jsdom) —
// all three need stubbing or nodes stay "unmeasured" and edges never render.
// The callback fires on a microtask (real ResizeObservers are async too),
// which matters here: firing synchronously would race ahead of the
// <ReactFlow> root's own mount effect that registers the container DOM node
// the measurement code looks up.
class ResizeObserverStub {
  private readonly callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }

  observe(target: Element) {
    queueMicrotask(() => {
      this.callback(
        [
          {
            target,
            contentRect: boundingClientRectStub(),
          } as ResizeObserverEntry,
        ],
        this as unknown as ResizeObserver,
      );
    });
  }

  unobserve() {}
  disconnect() {}
}

const boundingClientRectStub = () =>
  ({
    width: 120,
    height: 40,
    top: 0,
    left: 0,
    right: 120,
    bottom: 40,
    x: 0,
    y: 0,
    toJSON() {},
  }) as DOMRect;

// jsdom has no DOMMatrixReadOnly, which @xyflow/react uses to read the
// viewport's current zoom (m22) off its computed `transform` style.
class DOMMatrixReadOnlyStub {
  m22 = 1;
}

// jsdom also has no SVGElement.getBBox, which the edge label uses to size
// its background rect before deciding whether the label is "visible".
function getBBoxStub(): DOMRect {
  return {
    x: 0,
    y: 0,
    width: 80,
    height: 16,
    top: 0,
    left: 0,
    right: 80,
    bottom: 16,
    toJSON() {},
  } as DOMRect;
}

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

const entities = [
  {
    id: "ent-1",
    name: "Goblin",
    description: null,
    type: "NPC",
    visibility: "PUBLIC",
    tags: [],
  },
  {
    id: "ent-2",
    name: "Thornwood",
    description: null,
    type: "LOCATION",
    visibility: "PUBLIC",
    tags: [],
  },
];

interface RelationshipMock {
  id: string;
  // Null when the API redacts a concealed endpoint (KAN-134) for this viewer.
  sourceEntityId: string | null;
  targetEntityId: string | null;
  type: string;
}

const relationships: RelationshipMock[] = [
  {
    id: "rel-1",
    sourceEntityId: "ent-1",
    targetEntityId: "ent-2",
    type: "MemberOf",
  },
];

function setupMocks({
  members = ownerMembers,
  entitiesResult = entities,
  relationshipsResult = relationships,
  reexecuteEntities = vi.fn(),
  reexecuteRelationships = vi.fn(),
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
    if (args.query === EntitiesDocument) {
      return [
        { data: { entities: entitiesResult }, fetching: false, stale: false },
        reexecuteEntities,
      ];
    }
    if (args.query === RelationshipsDocument) {
      return [
        {
          data: { relationships: relationshipsResult },
          fetching: false,
          stale: false,
        },
        reexecuteRelationships,
      ];
    }
    throw new Error("Unexpected query in test");
  }) as never);

  return { reexecuteEntities, reexecuteRelationships };
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
        <RelationshipGraphWindow />
      </MemoryRouter>
    </WindowChromeContext.Provider>,
  );
  return chromeApi;
}

describe("RelationshipGraphWindow", () => {
  let originalOffsetWidth: PropertyDescriptor | undefined;
  let originalOffsetHeight: PropertyDescriptor | undefined;

  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
    vi.stubGlobal("DOMMatrixReadOnly", DOMMatrixReadOnlyStub);
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
      boundingClientRectStub,
    );
    // jsdom never lays anything out, so offsetWidth/offsetHeight (what
    // @xyflow/react actually reads to decide a node is "measured") stay 0.
    originalOffsetWidth = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      "offsetWidth",
    );
    originalOffsetHeight = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      "offsetHeight",
    );
    Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
      configurable: true,
      value: 120,
    });
    Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
      configurable: true,
      value: 40,
    });
    (SVGElement.prototype as unknown as { getBBox: () => DOMRect }).getBBox =
      getBBoxStub;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    if (originalOffsetWidth) {
      Object.defineProperty(
        HTMLElement.prototype,
        "offsetWidth",
        originalOffsetWidth,
      );
    }
    if (originalOffsetHeight) {
      Object.defineProperty(
        HTMLElement.prototype,
        "offsetHeight",
        originalOffsetHeight,
      );
    }
    delete (SVGElement.prototype as unknown as { getBBox?: () => DOMRect })
      .getBBox;
  });

  it("renders a node per entity labelled with name and type", () => {
    setupMocks();
    setupDesktopWindows();
    renderWindow();

    expect(screen.getByText("Goblin (NPC)")).toBeInTheDocument();
    expect(screen.getByText("Thornwood (LOCATION)")).toBeInTheDocument();
  });

  it("renders an edge label per relationship type", async () => {
    setupMocks();
    setupDesktopWindows();
    renderWindow();

    expect(await screen.findByText("MemberOf")).toBeInTheDocument();
  });

  it("shows an empty state when the campaign has no entities", () => {
    setupMocks({ entitiesResult: [], relationshipsResult: [] });
    setupDesktopWindows();
    renderWindow();

    expect(
      screen.getByText("No entities yet — add some NPCs to see the graph."),
    ).toBeInTheDocument();
  });

  it("opens the clicked entity's window", () => {
    // fireEvent.click (a bare "click" DOM event) rather than userEvent.click
    // — userEvent's full pointerdown/mousedown/mouseup sequence trips over
    // @xyflow/react's d3-zoom pane handlers under jsdom (d3-drag reads
    // event.view.document, which jsdom leaves null on synthetic mousedown).
    // onNodeClick only needs the "click" itself.
    setupMocks();
    const { openWindow } = setupDesktopWindows();
    renderWindow();

    fireEvent.click(screen.getByText("Goblin (NPC)"));

    expect(openWindow).toHaveBeenCalledWith(
      expect.objectContaining({ id: "entity:ent-1", title: "Goblin" }),
    );
  });

  it("reports its loading state and a network-only refresh to the window chrome", () => {
    const { reexecuteEntities, reexecuteRelationships } = setupMocks();
    setupDesktopWindows();
    const chromeApi = renderWindow();

    expect(chromeApi.setLoading).toHaveBeenCalledWith(false);
    const registered = chromeApi.setOnRefresh.mock.calls.at(-1)?.[0]() as
      (() => void) | undefined;
    registered?.();

    expect(reexecuteEntities).toHaveBeenCalledWith({
      requestPolicy: "network-only",
    });
    expect(reexecuteRelationships).toHaveBeenCalledWith({
      requestPolicy: "network-only",
    });
  });

  it("shows the Add Relationship button for a writer role", () => {
    setupMocks({ members: ownerMembers });
    setupDesktopWindows();
    renderWindow();

    expect(
      screen.getByRole("button", { name: "Add Relationship" }),
    ).toBeInTheDocument();
  });

  it("hides the Add Relationship button for a Player", () => {
    setupMocks({ members: playerMembers });
    setupDesktopWindows();
    renderWindow();

    expect(
      screen.queryByRole("button", { name: "Add Relationship" }),
    ).not.toBeInTheDocument();
  });

  it("opens the create-relationship window when a writer clicks Add Relationship", () => {
    setupMocks({ members: ownerMembers });
    const { openWindow } = setupDesktopWindows();
    renderWindow();

    fireEvent.click(screen.getByRole("button", { name: "Add Relationship" }));

    expect(openWindow).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "relationship-form:new",
        title: "New Relationship",
      }),
    );
  });

  it("opens the edit-relationship window when a writer clicks an edge", async () => {
    setupMocks({ members: ownerMembers });
    const { openWindow } = setupDesktopWindows();
    renderWindow();

    fireEvent.click(await screen.findByText("MemberOf"));

    expect(openWindow).toHaveBeenCalledWith(
      expect.objectContaining({ id: "relationship-form:rel-1" }),
    );
  });

  it("does not open an edit window when a Player clicks an edge", async () => {
    setupMocks({ members: playerMembers });
    const { openWindow } = setupDesktopWindows();
    renderWindow();

    fireEvent.click(await screen.findByText("MemberOf"));

    expect(openWindow).not.toHaveBeenCalledWith(
      expect.objectContaining({ id: "relationship-form:rel-1" }),
    );
  });

  it("skips a concealed relationship's edge instead of crashing on a null endpoint", () => {
    setupMocks({
      relationshipsResult: [
        {
          id: "rel-concealed",
          sourceEntityId: "ent-1",
          // Redacted by the API for this viewer (KAN-134) — there's no node
          // to draw this edge to.
          targetEntityId: null,
          type: "Blackmails",
        },
        ...relationships,
      ],
    });
    setupDesktopWindows();

    expect(() => renderWindow()).not.toThrow();
    expect(screen.queryByText("Blackmails")).not.toBeInTheDocument();
  });
});
