import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CalendarDays } from "lucide-react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Taskbar } from "./Taskbar";
import type { TaskbarItem } from "./Taskbar";

const ITEMS: TaskbarItem[] = [
  { id: "sessions", title: "Sessions", icon: CalendarDays, state: "active" },
  { id: "notes", title: "Notes", state: "minimized" },
];

function renderTaskbar(overrides: Partial<Parameters<typeof Taskbar>[0]> = {}) {
  const props = {
    items: ITEMS,
    role: "STORYTELLER" as const,
    startOpen: false,
    onStartToggle: vi.fn(),
    onTaskClick: vi.fn(),
    onShowDesktop: vi.fn(),
    ...overrides,
  };
  render(<Taskbar {...props} />);
  return props;
}

beforeEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.theme;
});

describe("Taskbar", () => {
  it("renders one button per open window", () => {
    renderTaskbar();

    const tasks = screen.getByRole("group", { name: "Open windows" });
    expect(within(tasks).getAllByRole("button")).toHaveLength(2);
  });

  it("marks the focused window as pressed and a minimized one as not", () => {
    renderTaskbar();

    expect(screen.getByRole("button", { name: /Sessions/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: /Notes/ })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("reports which window was clicked", async () => {
    const user = userEvent.setup();
    const { onTaskClick } = renderTaskbar();

    await user.click(screen.getByRole("button", { name: /Notes/ }));

    expect(onTaskClick).toHaveBeenCalledWith("notes");
  });

  it("toggles the start menu", async () => {
    const user = userEvent.setup();
    const { onStartToggle } = renderTaskbar();

    await user.click(screen.getByRole("button", { name: /StoryForge/ }));

    expect(onStartToggle).toHaveBeenCalledTimes(1);
  });

  it("shows the caller's role", () => {
    renderTaskbar({ role: "CO_STORYTELLER" });

    expect(screen.getByText("Co-Storyteller")).toBeInTheDocument();
  });

  it("cycles the theme from the tray", async () => {
    const user = userEvent.setup();
    renderTaskbar();

    await user.click(
      screen.getByRole("button", { name: "Theme: following system" }),
    );

    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("shows the desktop when the peek strip is clicked", async () => {
    const user = userEvent.setup();
    const { onShowDesktop } = renderTaskbar();

    await user.click(screen.getByRole("button", { name: "Show desktop" }));

    expect(onShowDesktop).toHaveBeenCalledTimes(1);
  });

  // The mobile shell shows one panel at a time, so there is no desktop to
  // peek at and no strip for it.
  it("omits the peek strip when no handler is given", () => {
    renderTaskbar({ onShowDesktop: undefined });

    expect(
      screen.queryByRole("button", { name: "Show desktop" }),
    ).not.toBeInTheDocument();
  });
});
