import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Window } from "./Window";

describe("Window", () => {
  it("renders the title and children", () => {
    render(
      <Window title="NPCs" onClose={vi.fn()}>
        <p>Body content</p>
      </Window>,
    );

    expect(screen.getByText("NPCs")).toBeInTheDocument();
    expect(screen.getByText("Body content")).toBeInTheDocument();
  });

  it("calls onClose when the close button is clicked", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <Window title="NPCs" onClose={onClose}>
        <p>Body content</p>
      </Window>,
    );

    await user.click(screen.getByRole("button", { name: "Close NPCs" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("forwards pointer down on the title bar for drag handling", () => {
    const onTitleBarPointerDown = vi.fn();
    render(
      <Window
        title="NPCs"
        onClose={vi.fn()}
        onTitleBarPointerDown={onTitleBarPointerDown}
      >
        <p>Body content</p>
      </Window>,
    );

    const titleBar = screen.getByText("NPCs").closest("div")!;
    titleBar.dispatchEvent(
      new Event("pointerdown", { bubbles: true, cancelable: true }),
    );

    expect(onTitleBarPointerDown).toHaveBeenCalledTimes(1);
  });

  it("forwards pointer down on the resize handle for resize handling", () => {
    const onResizeHandlePointerDown = vi.fn();
    render(
      <Window
        title="NPCs"
        onClose={vi.fn()}
        onResizeHandlePointerDown={onResizeHandlePointerDown}
      >
        <p>Body content</p>
      </Window>,
    );

    const handle = screen.getByLabelText("Resize NPCs");
    handle.dispatchEvent(
      new Event("pointerdown", { bubbles: true, cancelable: true }),
    );

    expect(onResizeHandlePointerDown).toHaveBeenCalledTimes(1);
  });

  it("applies inline style for position/size", () => {
    render(
      <Window
        title="NPCs"
        onClose={vi.fn()}
        style={{ left: 28, top: 24, width: 310, height: 280 }}
      >
        <p>Body content</p>
      </Window>,
    );

    const windowEl = screen
      .getByText("Body content")
      .closest("div[style]") as HTMLElement;
    expect(windowEl.style.left).toBe("28px");
    expect(windowEl.style.width).toBe("310px");
  });
});
