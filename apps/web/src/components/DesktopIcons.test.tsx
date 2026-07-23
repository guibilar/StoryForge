import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DesktopIcons } from "./DesktopIcons";
import { useDesktopWindows } from "../lib/DesktopWindowsContext";
import { createDesktopWindowsStub } from "../lib/desktopWindowsStub";

vi.mock("../lib/DesktopWindowsContext", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../lib/DesktopWindowsContext")>();
  return { ...actual, useDesktopWindows: vi.fn() };
});

const LAYOUT = {
  sessions: { x: 0, y: 0, width: 300, height: 200, hidden: false, z: 2 },
  timeline: { x: 0, y: 0, width: 300, height: 200, hidden: true, z: 1 },
};

function renderIcons(overrides = {}) {
  vi.mocked(useDesktopWindows).mockReturnValue(
    createDesktopWindowsStub({ layout: LAYOUT, ...overrides }),
  );
  render(<DesktopIcons role="OWNER" />);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("DesktopIcons", () => {
  it("shows one icon per window the role can see", () => {
    renderIcons();

    expect(
      screen.getByRole("button", { name: "Timeline" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Members" })).toBeInTheDocument();
  });

  it("hides role-restricted windows", () => {
    vi.mocked(useDesktopWindows).mockReturnValue(
      createDesktopWindowsStub({ layout: LAYOUT }),
    );
    render(<DesktopIcons role="PLAYER" />);

    expect(
      screen.queryByRole("button", { name: "Members" }),
    ).not.toBeInTheDocument();
  });

  // A single click on a desktop icon selects; it takes a double-click (or
  // Enter) to open, so dragging across the icons doesn't open six windows.
  it("selects on a single click without opening", async () => {
    const user = userEvent.setup();
    const toggle = vi.fn();
    renderIcons({ toggle });

    await user.click(screen.getByRole("button", { name: "Timeline" }));

    expect(screen.getByRole("button", { name: "Timeline" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(toggle).not.toHaveBeenCalled();
  });

  it("opens a closed window on double-click", async () => {
    const user = userEvent.setup();
    const toggle = vi.fn();
    renderIcons({ toggle });

    await user.dblClick(screen.getByRole("button", { name: "Timeline" }));

    expect(toggle).toHaveBeenCalledWith("timeline");
  });

  it("opens on Enter for keyboard users", async () => {
    const user = userEvent.setup();
    const toggle = vi.fn();
    renderIcons({ toggle });

    screen.getByRole("button", { name: "Timeline" }).focus();
    await user.keyboard("{Enter}");

    expect(toggle).toHaveBeenCalledWith("timeline");
  });

  it("raises an already-open window instead of closing it", async () => {
    const user = userEvent.setup();
    const toggle = vi.fn();
    const bringToFront = vi.fn();
    renderIcons({ toggle, bringToFront });

    await user.dblClick(screen.getByRole("button", { name: "Sessions" }));

    expect(bringToFront).toHaveBeenCalledWith("sessions");
    expect(toggle).not.toHaveBeenCalled();
  });

  it("restores a minimized window", async () => {
    const user = userEvent.setup();
    const restoreWindow = vi.fn();
    renderIcons({
      restoreWindow,
      layout: {
        ...LAYOUT,
        sessions: { ...LAYOUT.sessions, minimized: true },
      },
    });

    await user.dblClick(screen.getByRole("button", { name: "Sessions" }));

    expect(restoreWindow).toHaveBeenCalledWith("sessions");
  });
});
