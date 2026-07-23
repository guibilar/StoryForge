import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
import { createDesktopWindowsStub } from "../lib/desktopWindowsStub";

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
    category: "CHARACTER",
    visibility: "PUBLIC",
    tags: [],
  },
  {
    id: "ent-2",
    name: "Thornwood",
    description: null,
    type: "LOCATION",
    category: "LOCATION",
    visibility: "PUBLIC",
    tags: [],
  },
];

// A faction with two character members, plus a location that merely sits
// inside it — the case that must not be swept into the cluster.
const factionEntities = [
  {
    id: "org-1",
    name: "The Camarilla",
    description: null,
    type: "sect",
    category: "ORGANIZATION",
    visibility: "PUBLIC",
    tags: [],
  },
  {
    id: "ent-3",
    name: "Sable",
    description: null,
    type: "NPC",
    category: "CHARACTER",
    visibility: "PUBLIC",
    tags: [],
  },
  {
    id: "ent-4",
    name: "Wren",
    description: null,
    type: "NPC",
    category: "CHARACTER",
    visibility: "PUBLIC",
    tags: [],
  },
  ...entities,
];

const factionRelationships = [
  {
    id: "rel-m1",
    sourceEntityId: "ent-1",
    targetEntityId: "org-1",
    type: "MemberOf",
  },
  {
    id: "rel-m2",
    sourceEntityId: "ent-3",
    targetEntityId: "org-1",
    type: "MemberOf",
  },
  {
    id: "rel-loc",
    sourceEntityId: "ent-2",
    targetEntityId: "org-1",
    type: "LocatedAt",
  },
  // A person who merely works out of the chapterhouse. Same category pair as
  // a real membership, so only the type tells them apart.
  {
    id: "rel-loc2",
    sourceEntityId: "ent-4",
    targetEntityId: "org-1",
    type: "LocatedAt",
  },
];

interface RelationshipMock {
  id: string;
  // Null when the API redacts a concealed endpoint (KAN-134) for this viewer.
  sourceEntityId: string | null;
  targetEntityId: string | null;
  concealedEndpoint?: "SOURCE" | "TARGET" | null;
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

    expect(screen.getByText("Goblin")).toBeInTheDocument();
    expect(screen.getByText("NPC")).toBeInTheDocument();
    expect(screen.getByText("Thornwood")).toBeInTheDocument();
    expect(screen.getByText("LOCATION")).toBeInTheDocument();
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

    fireEvent.click(screen.getByText("Goblin"));

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

  // KAN-134: the API redacts the concealed side's id but keeps the row — the
  // graph stands an "Unknown" node in for it, matching how EntityWindow's
  // relationship list names the same hidden counterpart.
  it("renders a concealed endpoint as an Unknown placeholder node", async () => {
    setupMocks({
      relationshipsResult: [
        {
          id: "rel-concealed",
          sourceEntityId: "ent-1",
          targetEntityId: null,
          concealedEndpoint: "TARGET",
          type: "Blackmails",
        },
        ...relationships,
      ],
    });
    setupDesktopWindows();
    renderWindow();

    expect(screen.getByText("Unknown")).toBeInTheDocument();
    expect(screen.getByText("Concealed")).toBeInTheDocument();
    expect(await screen.findByText("Blackmails")).toBeInTheDocument();
  });

  it("gives each concealed endpoint its own placeholder", () => {
    setupMocks({
      relationshipsResult: [
        {
          id: "rel-a",
          sourceEntityId: null,
          targetEntityId: "ent-1",
          concealedEndpoint: "SOURCE",
          type: "Blackmails",
        },
        {
          id: "rel-b",
          sourceEntityId: null,
          targetEntityId: "ent-2",
          concealedEndpoint: "SOURCE",
          type: "Serves",
        },
      ],
    });
    setupDesktopWindows();
    renderWindow();

    // Sharing one node between them would assert the two hidden parties are
    // the same person — precisely the secret being kept.
    expect(screen.getAllByText("Unknown")).toHaveLength(2);
  });

  it("does not open a window when a placeholder node is clicked", () => {
    setupMocks({
      relationshipsResult: [
        {
          id: "rel-concealed",
          sourceEntityId: "ent-1",
          targetEntityId: null,
          concealedEndpoint: "TARGET",
          type: "Blackmails",
        },
      ],
    });
    const { openWindow } = setupDesktopWindows();
    renderWindow();

    fireEvent.click(screen.getByText("Unknown"));

    expect(openWindow).not.toHaveBeenCalled();
  });

  describe("grouping", () => {
    async function groupByFaction() {
      const user = userEvent.setup();
      await user.selectOptions(
        screen.getByRole("combobox", { name: /group by/i }),
        "Faction / Affiliation",
      );
      return user;
    }

    it("replaces the organization's node with a labelled cluster", async () => {
      setupMocks({
        entitiesResult: factionEntities,
        relationshipsResult: factionRelationships,
      });
      setupDesktopWindows();
      renderWindow();

      // Present as an ordinary node until grouping is switched on.
      expect(screen.getByText("The Camarilla")).toBeInTheDocument();
      expect(screen.getByText("sect")).toBeInTheDocument();

      await groupByFaction();

      // Now it's the boundary, not a node: the name survives as the hull's
      // label (and again in the cluster list), but its type caption goes with
      // the node it replaced.
      expect(screen.getAllByText("The Camarilla").length).toBeGreaterThan(0);
      expect(screen.queryByText("sect")).not.toBeInTheDocument();
    });

    it("lists each cluster with its member count", async () => {
      setupMocks({
        entitiesResult: factionEntities,
        relationshipsResult: factionRelationships,
      });
      setupDesktopWindows();
      renderWindow();
      await groupByFaction();

      const row = screen.getByRole("checkbox", { name: /The Camarilla/ });
      expect(row).toBeChecked();
      expect(screen.getByText("2")).toBeInTheDocument();
    });

    it("hides a cluster's members when it is unticked", async () => {
      setupMocks({
        entitiesResult: factionEntities,
        relationshipsResult: factionRelationships,
      });
      setupDesktopWindows();
      renderWindow();
      const user = await groupByFaction();

      expect(screen.getByText("Goblin")).toBeInTheDocument();

      await user.click(screen.getByRole("checkbox", { name: /The Camarilla/ }));

      expect(screen.queryByText("Goblin")).not.toBeInTheDocument();
      expect(screen.queryByText("Sable")).not.toBeInTheDocument();
    });

    it("drops membership edges, which the hull already expresses", async () => {
      setupMocks({
        entitiesResult: factionEntities,
        relationshipsResult: factionRelationships,
      });
      setupDesktopWindows();
      renderWindow();

      // Edge labels are buttons; "MemberOf" also names an affiliation
      // checkbox in the cluster panel, which is not an edge.
      expect(
        await screen.findAllByRole("button", { name: "MemberOf" }),
      ).toHaveLength(2);

      await groupByFaction();

      expect(
        screen.queryAllByRole("button", { name: "MemberOf" }),
      ).toHaveLength(0);
    });

    // The heart of it: LocatedAt joins a character to an organization without
    // making them part of it, and only the type string tells the two apart —
    // the category pair is identical to a real membership.
    it("does not treat LocatedAt as belonging to the faction", async () => {
      setupMocks({
        entitiesResult: factionEntities,
        relationshipsResult: factionRelationships,
      });
      setupDesktopWindows();
      renderWindow();
      await groupByFaction();

      // Goblin and Sable are members; Wren only works out of the building.
      expect(screen.getByText("2")).toBeInTheDocument();
      expect(screen.getByText("Wren")).toBeInTheDocument();
      expect(screen.getByText("Thornwood")).toBeInTheDocument();
    });

    it("lets the Storyteller choose which types mean affiliation", async () => {
      setupMocks({
        entitiesResult: factionEntities,
        relationshipsResult: factionRelationships,
      });
      setupDesktopWindows();
      renderWindow();
      const user = await groupByFaction();

      // MemberOf is the app's own suggestion for CHARACTER|ORGANIZATION, so it
      // starts ticked; LocatedAt is offered but off.
      expect(screen.getByRole("checkbox", { name: "MemberOf" })).toBeChecked();
      expect(
        screen.getByRole("checkbox", { name: "LocatedAt" }),
      ).not.toBeChecked();

      await user.click(screen.getByRole("checkbox", { name: "LocatedAt" }));

      // Wren now counts as affiliated too.
      expect(screen.getByText("3")).toBeInTheDocument();
    });

    it("dissolves the cluster when no type counts as affiliation", async () => {
      setupMocks({
        entitiesResult: factionEntities,
        relationshipsResult: factionRelationships,
      });
      setupDesktopWindows();
      renderWindow();
      const user = await groupByFaction();

      await user.click(screen.getByRole("checkbox", { name: "MemberOf" }));

      // Nothing affiliates anyone, so the organization comes back as an
      // ordinary node — type caption and all.
      expect(screen.getByText("sect")).toBeInTheDocument();
    });
  });

  // Two entities can hold several relationships at once. Every built-in edge
  // type routes them along the identical curve, stacking the lines and
  // overprinting the labels into an unreadable smear ("E[ RESENTS ]Y").
  it("fans parallel relationships apart instead of stacking them", async () => {
    setupMocks({
      relationshipsResult: [
        {
          id: "rel-a",
          sourceEntityId: "ent-1",
          targetEntityId: "ent-2",
          type: "Enemy",
        },
        {
          // Reversed direction, same pair of nodes on screen.
          id: "rel-b",
          sourceEntityId: "ent-2",
          targetEntityId: "ent-1",
          type: "Resents",
        },
      ],
    });
    setupDesktopWindows();
    renderWindow();

    // Both survive as their own labelled edge rather than one overprinting
    // the other. The bow that separates them geometrically is unit-tested on
    // parallelEdgeOffsets — jsdom measures every node to the same rect, so
    // rendered coordinates here would be identical no matter what.
    expect(await screen.findByRole("button", { name: "Enemy" })).toBeVisible();
    expect(
      await screen.findByRole("button", { name: "Resents" }),
    ).toBeVisible();
  });

  it("still drops an edge whose null endpoint isn't explained by concealment", () => {
    setupMocks({
      relationshipsResult: [
        {
          id: "rel-orphan",
          sourceEntityId: "ent-1",
          // No concealedEndpoint to account for the null: this points at an
          // entity the viewer was never shown, so it stays off the graph
          // rather than advertising its type through a placeholder.
          targetEntityId: null,
          concealedEndpoint: null,
          type: "Blackmails",
        },
        ...relationships,
      ],
    });
    setupDesktopWindows();

    expect(() => renderWindow()).not.toThrow();
    expect(screen.queryByText("Blackmails")).not.toBeInTheDocument();
    expect(screen.queryByText("Unknown")).not.toBeInTheDocument();
  });
});
