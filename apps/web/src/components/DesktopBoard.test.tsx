import { act, render, screen, within } from "@testing-library/react";
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
import { DesktopWindowsContext } from "../lib/DesktopWindowsContext";

// DesktopBoard now reads window state from context (KAN-96 lifted ownership
// up to CampaignDesktopPage so a sibling sidebar can share it) rather than
// owning it itself — this harness stands in for that owner in isolation.
function Harness({
  campaignId,
  role,
}: {
  campaignId: string;
  role?: CampaignRole;
}) {
  const desktopWindows = useDesktopWindowsController(campaignId);
  return (
    <DesktopWindowsContext.Provider value={desktopWindows}>
      <DesktopBoard role={role} />
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

    expect(screen.getByText("NPCs", { selector: "span" })).toBeInTheDocument();
    expect(
      screen.getByText("Members", { selector: "span" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Sessions", { selector: "span" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Timeline", { selector: "span" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Notes", { selector: "span" }),
    ).not.toBeInTheDocument();
  });

  it("opens a hidden window from the dock and closes it again", async () => {
    const user = userEvent.setup();
    render(<Harness campaignId="camp-1" />);

    await user.click(screen.getByRole("button", { name: "Timeline" }));
    expect(screen.getByText("No events yet.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Close Timeline" }));
    expect(screen.queryByText("No events yet.")).not.toBeInTheDocument();
  });

  it("persists the arrangement so a remount restores it", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<Harness campaignId="camp-1" />);

    await user.click(screen.getByRole("button", { name: "Timeline" }));
    unmount();

    render(<Harness campaignId="camp-1" />);
    expect(screen.getByText("No events yet.")).toBeInTheDocument();
  });

  it("reset layout restores the defaults", async () => {
    const user = userEvent.setup();
    render(<Harness campaignId="camp-1" />);

    await user.click(screen.getByRole("button", { name: "Timeline" }));
    await user.click(screen.getByRole("button", { name: "Reset layout" }));

    expect(screen.queryByText("No events yet.")).not.toBeInTheDocument();
  });

  it("drags a window by its title bar and persists the new position", () => {
    render(<Harness campaignId="camp-1" />);

    const board = screen.getByTestId("desktop-board");
    mockRect(board, { left: 0, top: 0, width: 1000, height: 800 });

    const npcsTitle = screen.getByText("NPCs", { selector: "span" });
    const windowEl = npcsTitle.closest("div[style]") as HTMLElement;
    mockRect(windowEl, { left: 28, top: 24, width: 310, height: 280 });

    act(() => {
      npcsTitle.dispatchEvent(
        new PointerEvent("pointerdown", {
          bubbles: true,
          clientX: 50,
          clientY: 50,
        }),
      );
    });

    expect(windowEl.style.left).toBe("28px");

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
    expect(stored.npcs.x).toBe(128);
  });

  it("resizes a window by its handle and persists the new size", () => {
    render(<Harness campaignId="camp-1" />);

    const board = screen.getByTestId("desktop-board");
    mockRect(board, { left: 0, top: 0, width: 1000, height: 800 });

    const npcsTitle = screen.getByText("NPCs", { selector: "span" });
    const windowEl = npcsTitle.closest("div[style]") as HTMLElement;
    mockRect(windowEl, { left: 28, top: 24, width: 310, height: 280 });

    const handle = screen.getByLabelText("Resize NPCs");

    act(() => {
      handle.dispatchEvent(
        new PointerEvent("pointerdown", {
          bubbles: true,
          clientX: 338,
          clientY: 304,
        }),
      );
    });

    expect(windowEl.style.width).toBe("310px");

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
    expect(stored.npcs.width).toBe(410);
    expect(stored.npcs.height).toBe(380);
  });

  it("clamps resize to the minimum size and the board bounds", () => {
    render(<Harness campaignId="camp-1" />);

    const board = screen.getByTestId("desktop-board");
    mockRect(board, { left: 0, top: 0, width: 1000, height: 800 });

    const npcsTitle = screen.getByText("NPCs", { selector: "span" });
    const windowEl = npcsTitle.closest("div[style]") as HTMLElement;
    mockRect(windowEl, { left: 28, top: 24, width: 310, height: 280 });

    const handle = screen.getByLabelText("Resize NPCs");

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

  it("saves the current arrangement as a named preset and restores it later", async () => {
    const user = userEvent.setup();
    const promptSpy = vi.spyOn(window, "prompt").mockReturnValue("My Layout");
    render(<Harness campaignId="camp-1" />);

    const board = screen.getByTestId("desktop-board");
    mockRect(board, { left: 0, top: 0, width: 1000, height: 800 });
    const npcsTitle = screen.getByText("NPCs", { selector: "span" });
    const windowEl = npcsTitle.closest("div[style]") as HTMLElement;
    mockRect(windowEl, { left: 28, top: 24, width: 310, height: 280 });

    // Move NPCs, then save that arrangement as a preset.
    act(() => {
      npcsTitle.dispatchEvent(
        new PointerEvent("pointerdown", {
          bubbles: true,
          clientX: 50,
          clientY: 50,
        }),
      );
    });
    act(() => {
      window.dispatchEvent(
        new PointerEvent("pointermove", { clientX: 150, clientY: 150 }),
      );
    });
    act(() => {
      window.dispatchEvent(new PointerEvent("pointerup"));
    });
    expect(windowEl.style.left).toBe("128px");

    await user.click(screen.getByRole("button", { name: "Save as preset" }));
    expect(promptSpy).toHaveBeenCalled();

    // Reset scatters it back to the shipped default position...
    await user.click(screen.getByRole("button", { name: "Reset layout" }));
    expect(windowEl.style.left).toBe("28px");

    // ...and loading the saved preset brings it back.
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Load layout preset" }),
      "My Layout",
    );
    expect(windowEl.style.left).toBe("128px");
  });

  it("does not save a preset when the name prompt is cancelled", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "prompt").mockReturnValue(null);
    render(<Harness campaignId="camp-1" />);

    await user.click(screen.getByRole("button", { name: "Save as preset" }));

    const select = screen.getByRole("combobox", { name: "Load layout preset" });
    expect(within(select).getAllByRole("option")).toHaveLength(1);
  });
});
