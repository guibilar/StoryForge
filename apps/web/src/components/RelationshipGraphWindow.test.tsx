import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useQuery } from "urql";

import { RelationshipGraphWindow } from "./RelationshipGraphWindow";
import { useDesktopWindows } from "../lib/DesktopWindowsContext";
import { EntitiesDocument, RelationshipsDocument } from "../gql/graphql";

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

const relationships = [
  {
    id: "rel-1",
    sourceEntityId: "ent-1",
    targetEntityId: "ent-2",
    type: "MemberOf",
  },
];

function setupMocks({
  entitiesResult = entities,
  relationshipsResult = relationships,
} = {}) {
  vi.mocked(useQuery).mockImplementation(((args: { query: unknown }) => {
    if (args.query === EntitiesDocument) {
      return [
        { data: { entities: entitiesResult }, fetching: false, stale: false },
        vi.fn(),
      ];
    }
    if (args.query === RelationshipsDocument) {
      return [
        {
          data: { relationships: relationshipsResult },
          fetching: false,
          stale: false,
        },
        vi.fn(),
      ];
    }
    throw new Error("Unexpected query in test");
  }) as never);
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
  render(
    <MemoryRouter>
      <RelationshipGraphWindow />
    </MemoryRouter>,
  );
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
});
