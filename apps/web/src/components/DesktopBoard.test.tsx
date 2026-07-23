import { useEffect } from "react";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { useMutation, useQuery } from "urql";

import { DesktopBoard } from "./DesktopBoard";
import {
  CampaignDocument,
  EntitiesDocument,
  EventsDocument,
  MeDocument,
  SessionsDocument,
} from "../gql/graphql";
import type { CampaignRole } from "../gql/graphql";
import { useDesktopWindowsController } from "../hooks/useDesktopWindowsController";
import {
  DesktopWindowsContext,
  type DesktopWindowsApi,
} from "../lib/DesktopWindowsContext";

// DesktopBoard now reads window state from context (KAN-96 lifted ownership
// up to CampaignDesktopPage so a sibling sidebar can share it) rather than
// owning it itself — this harness stands in for that owner in isolation.
// Opening/closing a hidden catalog window is normally done by a sibling
// (the start menu), not DesktopBoard itself, so tests that need
// to open one drive the shared controller directly via onReady instead of
// clicking a UI element DesktopBoard doesn't render.
function Harness({
  campaignId,
  role,
  onReady,
}: {
  campaignId: string;
  role?: CampaignRole;
  onReady?: (windows: DesktopWindowsApi) => void;
}) {
  const desktopWindows = useDesktopWindowsController(campaignId);
  onReady?.(desktopWindows);
  return (
    <DesktopWindowsContext.Provider value={desktopWindows}>
      <DesktopBoard campaignId={campaignId} role={role} />
    </DesktopWindowsContext.Provider>
  );
}

vi.mock("urql", async (importOriginal) => {
  const actual = await importOriginal<typeof import("urql")>();
  return { ...actual, useMutation: vi.fn(), useQuery: vi.fn() };
});

const CURRENT_USER_ID = "user-1";

vi.mocked(useQuery).mockImplementation(((args: { query: unknown }) => {
  if (args.query === MeDocument) {
    return [
      {
        data: { me: { id: CURRENT_USER_ID, email: "owner@example.com" } },
        fetching: false,
        stale: false,
      },
      vi.fn(),
    ];
  }

  if (args.query === CampaignDocument) {
    return [
      {
        data: {
          campaign: {
            id: "camp-1",
            name: "Campaign",
            members: [
              {
                userId: CURRENT_USER_ID,
                role: "OWNER",
                user: { id: CURRENT_USER_ID, email: "owner@example.com" },
              },
            ],
          },
        },
        fetching: false,
        stale: false,
      },
      vi.fn(),
    ];
  }

  if (args.query === EntitiesDocument) {
    return [{ data: { entities: [] }, fetching: false, stale: false }, vi.fn()];
  }

  if (args.query === EventsDocument) {
    return [{ data: { events: [] }, fetching: false, stale: false }, vi.fn()];
  }

  if (args.query === SessionsDocument) {
    return [{ data: { sessions: [] }, fetching: false, stale: false }, vi.fn()];
  }

  throw new Error("Unexpected query in test");
}) as never);

vi.mocked(useMutation).mockImplementation((() => [
  { fetching: false, stale: false },
  vi.fn(),
]) as never);

function mockRect(
  el: HTMLElement,
  rect: { left: number; top: number; width: number; height: number },
) {
  vi.spyOn(el, "getBoundingClientRect").mockReturnValue({
    ...rect,
    right: rect.left + rect.width,
    bottom: rect.top + rect.height,
    x: rect.left,
    y: rect.top,
    toJSON() {},
  } as DOMRect);
}

// "Sessions" now appears twice on the desk — once as a desktop icon's label,
// once as the open window's title — so window-title lookups scope themselves
// to the window subtree (Window marks it with data-window).
function windowTitle(name: string): HTMLElement {
  const match = screen
    .getAllByText(name, { selector: "span" })
    .find((el) => el.closest("[data-window]"));
  if (!match) {
    throw new Error(`No open window titled ${name}`);
  }
  return match;
}

function hasWindow(name: string): boolean {
  return screen
    .queryAllByText(name, { selector: "span" })
    .some((el) => el.closest("[data-window]"));
}

beforeEach(() => {
  localStorage.clear();
});

describe("DesktopBoard", () => {
  it("shows the default windows open/closed per the catalog defaults", () => {
    render(
      <MemoryRouter>
        <Harness campaignId="camp-1" role="OWNER" />
      </MemoryRouter>,
    );

    expect(hasWindow("Members")).toBe(true);
    expect(hasWindow("Sessions")).toBe(true);
    expect(hasWindow("Timeline")).toBe(false);
    expect(hasWindow("Notes")).toBe(false);
  });

  it("opens a hidden window via toggle and closes it again", async () => {
    const user = userEvent.setup();
    let windows!: DesktopWindowsApi;
    render(<Harness campaignId="camp-1" onReady={(w) => (windows = w)} />);

    act(() => windows.toggle("timeline"));
    expect(screen.getByText("No events yet.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Close Timeline" }));
    expect(screen.queryByText("No events yet.")).not.toBeInTheDocument();
  });

  it("does not steal focus into a window that's already visible on first render", () => {
    render(
      <MemoryRouter>
        <Harness campaignId="camp-1" role="OWNER" />
      </MemoryRouter>,
    );

    // Members and Sessions are both visible by default (DEFAULT_LAYOUT) —
    // neither was "opened" by a user action, so focus should stay wherever
    // the page naturally starts (nothing, in this harness) rather than
    // landing inside whichever one happened to mount last.
    expect(document.activeElement).toBe(document.body);
  });

  it("moves focus into a window that's opened via toggle after the first render", () => {
    let windows!: DesktopWindowsApi;
    render(<Harness campaignId="camp-1" onReady={(w) => (windows = w)} />);

    act(() => windows.toggle("timeline"));

    // Lands on the window's first real body content (the search field),
    // not chrome — see useFocusTrap's body-first preference.
    expect(screen.getByLabelText("Search events")).toHaveFocus();
  });

  it("persists the arrangement so a remount restores it", () => {
    let windows!: DesktopWindowsApi;
    const { unmount } = render(
      <Harness campaignId="camp-1" onReady={(w) => (windows = w)} />,
    );

    act(() => windows.toggle("timeline"));
    unmount();

    render(<Harness campaignId="camp-1" />);
    expect(screen.getByText("No events yet.")).toBeInTheDocument();
  });

  it("reset layout restores the defaults", () => {
    let windows!: DesktopWindowsApi;
    render(<Harness campaignId="camp-1" onReady={(w) => (windows = w)} />);

    act(() => windows.toggle("timeline"));
    act(() => windows.reset());

    expect(screen.queryByText("No events yet.")).not.toBeInTheDocument();
  });

  it("drags a window by its title bar and persists the new position", () => {
    render(<Harness campaignId="camp-1" />);

    const board = screen.getByTestId("desktop-board");
    mockRect(board, { left: 0, top: 0, width: 1000, height: 800 });

    const sessionsTitle = windowTitle("Sessions");
    const windowEl = sessionsTitle.closest("div[style]") as HTMLElement;
    mockRect(windowEl, { left: 28, top: 24, width: 310, height: 280 });

    act(() => {
      sessionsTitle.dispatchEvent(
        new PointerEvent("pointerdown", {
          bubbles: true,
          clientX: 50,
          clientY: 50,
        }),
      );
    });

    // Unmoved: reflects the real rendered layout (sessions' default x),
    // not the synthetic getBoundingClientRect() mocked above.
    expect(windowEl.style.left).toBe("754px");

    act(() => {
      window.dispatchEvent(
        new PointerEvent("pointermove", { clientX: 150, clientY: 150 }),
      );
    });

    expect(windowEl.style.left).toBe("128px");

    act(() => {
      window.dispatchEvent(new PointerEvent("pointerup"));
    });

    const stored = JSON.parse(
      localStorage.getItem("storyforge:desktop:camp-1")!,
    );
    expect(stored.sessions.x).toBe(128);
  });

  it("resizes a window by its handle and persists the new size", () => {
    render(<Harness campaignId="camp-1" />);

    const board = screen.getByTestId("desktop-board");
    mockRect(board, { left: 0, top: 0, width: 1000, height: 800 });

    const sessionsTitle = windowTitle("Sessions");
    const windowEl = sessionsTitle.closest("div[style]") as HTMLElement;
    mockRect(windowEl, { left: 28, top: 24, width: 310, height: 280 });

    const handle = screen.getByLabelText("Resize Sessions");

    act(() => {
      handle.dispatchEvent(
        new PointerEvent("pointerdown", {
          bubbles: true,
          clientX: 338,
          clientY: 304,
        }),
      );
    });

    // Unmoved: reflects the real rendered layout (sessions' default width),
    // not the synthetic getBoundingClientRect() mocked above.
    expect(windowEl.style.width).toBe("398px");

    act(() => {
      window.dispatchEvent(
        new PointerEvent("pointermove", { clientX: 438, clientY: 404 }),
      );
    });

    expect(windowEl.style.width).toBe("410px");
    expect(windowEl.style.height).toBe("380px");

    act(() => {
      window.dispatchEvent(new PointerEvent("pointerup"));
    });

    const stored = JSON.parse(
      localStorage.getItem("storyforge:desktop:camp-1")!,
    );
    expect(stored.sessions.width).toBe(410);
    expect(stored.sessions.height).toBe(380);
  });

  it("clamps resize to the minimum size and the board bounds", () => {
    render(<Harness campaignId="camp-1" />);

    const board = screen.getByTestId("desktop-board");
    mockRect(board, { left: 0, top: 0, width: 1000, height: 800 });

    const sessionsTitle = windowTitle("Sessions");
    const windowEl = sessionsTitle.closest("div[style]") as HTMLElement;
    mockRect(windowEl, { left: 28, top: 24, width: 310, height: 280 });

    const handle = screen.getByLabelText("Resize Sessions");

    act(() => {
      handle.dispatchEvent(
        new PointerEvent("pointerdown", {
          bubbles: true,
          clientX: 338,
          clientY: 304,
        }),
      );
    });

    act(() => {
      window.dispatchEvent(
        new PointerEvent("pointermove", { clientX: -900, clientY: -900 }),
      );
    });

    expect(windowEl.style.width).toBe("200px");
    expect(windowEl.style.height).toBe("150px");

    act(() => {
      window.dispatchEvent(
        new PointerEvent("pointermove", { clientX: 5000, clientY: 5000 }),
      );
    });

    expect(windowEl.style.width).toBe("972px");
    expect(windowEl.style.height).toBe("776px");

    act(() => {
      window.dispatchEvent(new PointerEvent("pointerup"));
    });
  });

  // Dragging used to push a layout update per pointermove, which re-rendered
  // every open window's content — the Leaflet map and relationship graph
  // included — at pointer-event rate. The gesture now drives the DOM directly
  // and commits once on pointerup.
  it("does not re-render other windows' content while a window is dragged", () => {
    let renders = 0;
    function CountingContent() {
      // Counted in a bodyless effect (runs after every commit) rather than
      // during render, which react-hooks/globals rightly rejects.
      useEffect(() => {
        renders += 1;
      });
      return <p>counted</p>;
    }

    let windows: DesktopWindowsApi | undefined;
    // onReady runs on every Harness render, so this counts layout-state
    // updates independently of whether memoisation absorbs them downstream.
    let stateUpdates = 0;
    render(
      <Harness
        campaignId="camp-1"
        onReady={(api) => {
          windows = api;
          stateUpdates += 1;
        }}
      />,
    );

    act(() =>
      windows!.openWindow({
        id: "entity:counted",
        title: "Counted",
        render: () => <CountingContent />,
        x: 10,
        y: 10,
        width: 200,
        height: 200,
      }),
    );
    expect(screen.getByText("counted")).toBeInTheDocument();

    const board = screen.getByTestId("desktop-board");
    mockRect(board, { left: 0, top: 0, width: 1000, height: 800 });
    const sessionsTitle = windowTitle("Sessions");
    const windowEl = sessionsTitle.closest("div[style]") as HTMLElement;
    mockRect(windowEl, { left: 28, top: 24, width: 310, height: 280 });

    act(() => {
      sessionsTitle.dispatchEvent(
        new PointerEvent("pointerdown", {
          bubbles: true,
          clientX: 50,
          clientY: 50,
        }),
      );
    });

    const rendersAtDragStart = renders;
    const updatesAtDragStart = stateUpdates;
    for (let step = 0; step < 10; step += 1) {
      act(() => {
        window.dispatchEvent(
          new PointerEvent("pointermove", {
            clientX: 150 + step,
            clientY: 150 + step,
          }),
        );
      });
    }

    expect(windowEl.style.left).toBe("137px");
    // Ten pointermoves, zero layout-state updates: the gesture moved the DOM
    // node itself rather than round-tripping through React each frame.
    expect(stateUpdates).toBe(updatesAtDragStart);
    expect(renders).toBe(rendersAtDragStart);

    act(() => {
      window.dispatchEvent(new PointerEvent("pointerup"));
    });

    // One commit at the end, and the memoised content element means the other
    // window's body is reused rather than rebuilt even for that.
    expect(stateUpdates).toBe(updatesAtDragStart + 1);
    expect(renders).toBe(rendersAtDragStart);
  });
});
