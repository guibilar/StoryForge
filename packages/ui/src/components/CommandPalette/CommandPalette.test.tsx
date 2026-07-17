import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CommandPalette } from "./CommandPalette";
import type { CommandPaletteSection } from "./CommandPalette";

const sections: CommandPaletteSection[] = [
  {
    label: "Recent",
    items: [
      { id: "recent-1", label: "Whisper Amulet" },
      { id: "recent-2", label: "Chapter 3" },
    ],
  },
  {
    label: "Actions",
    items: [
      { id: "action-1", label: "New entity" },
      { id: "action-2", label: "Export campaign" },
    ],
  },
];

function renderPalette(
  overrides: Partial<Parameters<typeof CommandPalette>[0]> = {},
) {
  const props = {
    open: true,
    query: "",
    onQueryChange: vi.fn(),
    sections,
    activeId: null as string | null,
    onActiveChange: vi.fn(),
    onCommit: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };

  const utils = render(<CommandPalette {...props} />);
  return { ...utils, props };
}

describe("CommandPalette", () => {
  it("renders nothing when open is false", () => {
    const { container } = renderPalette({ open: false });

    expect(container).toBeEmptyDOMElement();
  });

  it("renders section labels and items when open", () => {
    renderPalette();

    expect(screen.getByText("Recent")).toBeInTheDocument();
    expect(screen.getByText("Actions")).toBeInTheDocument();
    expect(screen.getByText("Whisper Amulet")).toBeInTheDocument();
    expect(screen.getByText("Chapter 3")).toBeInTheDocument();
    expect(screen.getByText("New entity")).toBeInTheDocument();
    expect(screen.getByText("Export campaign")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("calls onQueryChange when typing in the input", async () => {
    const user = userEvent.setup();
    const { props } = renderPalette();

    await user.type(screen.getByRole("combobox"), "hi");

    expect(props.onQueryChange).toHaveBeenCalledTimes(2);
    expect(props.onQueryChange).toHaveBeenNthCalledWith(1, "h");
    expect(props.onQueryChange).toHaveBeenNthCalledWith(2, "i");
  });

  it("moves activeId to the next item on ArrowDown", async () => {
    const user = userEvent.setup();
    const { props } = renderPalette({ activeId: "recent-1" });

    await user.click(screen.getByRole("combobox"));
    await user.keyboard("{ArrowDown}");

    expect(props.onActiveChange).toHaveBeenCalledWith("recent-2");
  });

  it("moves activeId to the previous item on ArrowUp", async () => {
    const user = userEvent.setup();
    const { props } = renderPalette({ activeId: "action-1" });

    await user.click(screen.getByRole("combobox"));
    await user.keyboard("{ArrowUp}");

    expect(props.onActiveChange).toHaveBeenCalledWith("recent-2");
  });

  it("clamps at the last item on ArrowDown and does not wrap", async () => {
    const user = userEvent.setup();
    const { props } = renderPalette({ activeId: "action-2" });

    await user.click(screen.getByRole("combobox"));
    await user.keyboard("{ArrowDown}");

    expect(props.onActiveChange).toHaveBeenCalledWith("action-2");
  });

  it("clamps at the first item on ArrowUp and does not wrap", async () => {
    const user = userEvent.setup();
    const { props } = renderPalette({ activeId: "recent-1" });

    await user.click(screen.getByRole("combobox"));
    await user.keyboard("{ArrowUp}");

    expect(props.onActiveChange).toHaveBeenCalledWith("recent-1");
  });

  it("calls onCommit with the active id on Enter", async () => {
    const user = userEvent.setup();
    const { props } = renderPalette({ activeId: "action-1" });

    await user.click(screen.getByRole("combobox"));
    await user.keyboard("{Enter}");

    expect(props.onCommit).toHaveBeenCalledWith("action-1");
  });

  it("does not call onCommit on Enter when activeId is null", async () => {
    const user = userEvent.setup();
    const { props } = renderPalette({ activeId: null });

    await user.click(screen.getByRole("combobox"));
    await user.keyboard("{Enter}");

    expect(props.onCommit).not.toHaveBeenCalled();
  });

  it("calls onClose on Escape", async () => {
    const user = userEvent.setup();
    const { props } = renderPalette();

    await user.click(screen.getByRole("combobox"));
    await user.keyboard("{Escape}");

    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onActiveChange and onCommit when clicking an item", async () => {
    const user = userEvent.setup();
    const { props } = renderPalette();

    await user.click(screen.getByText("New entity"));

    expect(props.onActiveChange).toHaveBeenCalledWith("action-1");
    expect(props.onCommit).toHaveBeenCalledWith("action-1");
  });

  it("calls onClose when clicking the backdrop but not when clicking inside the panel", async () => {
    const user = userEvent.setup();
    const { props } = renderPalette();

    await user.click(screen.getByRole("dialog"));
    expect(props.onClose).not.toHaveBeenCalled();

    const backdrop = screen.getByRole("dialog").parentElement!;
    await user.click(backdrop);

    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it("shows the empty message when every section has no items", () => {
    renderPalette({
      sections: [
        { label: "Recent", items: [] },
        { label: "Actions", items: [] },
      ],
    });

    expect(screen.getByText("No matches")).toBeInTheDocument();
    expect(screen.queryByText("Recent")).not.toBeInTheDocument();
  });
});
