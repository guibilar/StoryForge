import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Dock } from "./Dock";

const items = [
  { id: "npcs", title: "NPCs", open: true },
  { id: "notes", title: "Notes", open: false },
];

describe("Dock", () => {
  it("renders one button per item with pressed state matching open", () => {
    render(<Dock items={items} onToggle={vi.fn()} />);

    expect(screen.getByRole("button", { name: "NPCs" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Notes" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("calls onToggle with the item id when clicked", async () => {
    const onToggle = vi.fn();
    const user = userEvent.setup();
    render(<Dock items={items} onToggle={onToggle} />);

    await user.click(screen.getByRole("button", { name: "Notes" }));

    expect(onToggle).toHaveBeenCalledWith("notes");
  });
});
