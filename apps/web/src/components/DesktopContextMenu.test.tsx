import { createRef } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useMutation, useQuery } from "urql";

import { DesktopContextMenu } from "./DesktopContextMenu";
import { useDesktopWindows } from "../lib/DesktopWindowsContext";
import { createDesktopWindowsStub } from "../lib/desktopWindowsStub";
import type { CampaignRole } from "../gql/graphql";

vi.mock("urql", async (importOriginal) => {
  const actual = await importOriginal<typeof import("urql")>();
  return { ...actual, useQuery: vi.fn(), useMutation: vi.fn() };
});

vi.mock("../lib/DesktopWindowsContext", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../lib/DesktopWindowsContext")>();
  return { ...actual, useDesktopWindows: vi.fn() };
});

vi.mocked(useQuery).mockImplementation((() => [
  { data: undefined, fetching: false, stale: false },
  vi.fn(),
]) as never);
vi.mocked(useMutation).mockImplementation((() => [
  { fetching: false, stale: false },
  vi.fn(),
]) as never);

function renderMenu({
  role = "OWNER" as CampaignRole | undefined,
  windows = {},
} = {}) {
  vi.mocked(useDesktopWindows).mockReturnValue(
    createDesktopWindowsStub(windows),
  );
  const boardRef = createRef<HTMLDivElement>();

  function Harness() {
    return (
      <div ref={boardRef} data-testid="board">
        <DesktopContextMenu
          boardRef={boardRef}
          campaignId="camp-1"
          role={role}
        />
      </div>
    );
  }

  render(<Harness />);
  return { board: screen.getByTestId("board") };
}

function openMenu(board: HTMLElement) {
  fireEvent.contextMenu(board, { clientX: 40, clientY: 60 });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("DesktopContextMenu", () => {
  it("stays closed until the desk is right-clicked", () => {
    const { board } = renderMenu();

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    openMenu(board);

    expect(screen.getByRole("menu", { name: "Desktop" })).toBeInTheDocument();
  });

  // Right-clicking inside a window belongs to that window (and the browser),
  // not to the desk.
  it("ignores a right-click inside a window", () => {
    const { board } = renderMenu();
    const windowEl = document.createElement("div");
    windowEl.setAttribute("data-window", "");
    board.appendChild(windowEl);

    fireEvent.contextMenu(windowEl, { clientX: 40, clientY: 60 });

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("tiles the open windows", async () => {
    const user = userEvent.setup();
    const arrange = vi.fn();
    const { board } = renderMenu({ windows: { arrange } });
    openMenu(board);

    await user.click(screen.getByRole("menuitem", { name: "Tile windows" }));

    expect(arrange).toHaveBeenCalledWith("tile", expect.any(Object));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("cascades the open windows", async () => {
    const user = userEvent.setup();
    const arrange = vi.fn();
    const { board } = renderMenu({ windows: { arrange } });
    openMenu(board);

    await user.click(screen.getByRole("menuitem", { name: "Cascade windows" }));

    expect(arrange).toHaveBeenCalledWith("cascade", expect.any(Object));
  });

  it("shows the desktop and resets the layout", async () => {
    const user = userEvent.setup();
    const showDesktop = vi.fn();
    const reset = vi.fn();
    const { board } = renderMenu({ windows: { showDesktop, reset } });

    openMenu(board);
    await user.click(screen.getByRole("menuitem", { name: "Show desktop" }));
    expect(showDesktop).toHaveBeenCalled();

    openMenu(board);
    await user.click(screen.getByRole("menuitem", { name: "Reset layout" }));
    expect(reset).toHaveBeenCalled();
  });

  it("offers the create actions to writers only", () => {
    const { board } = renderMenu({ role: "PLAYER" });
    openMenu(board);

    expect(
      screen.queryByRole("menuitem", { name: "New note" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: "Tile windows" }),
    ).toBeInTheDocument();
  });

  it("dismisses on Escape", () => {
    const { board } = renderMenu();
    openMenu(board);

    fireEvent.keyDown(window, { key: "Escape" });

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});
