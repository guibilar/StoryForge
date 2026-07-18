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

  it("does not render a refresh button when onRefresh is omitted", () => {
    render(
      <Window title="NPCs" onClose={vi.fn()}>
        <p>Body content</p>
      </Window>,
    );

    expect(
      screen.queryByRole("button", { name: "Refresh NPCs" }),
    ).not.toBeInTheDocument();
  });

  it("calls onRefresh when the refresh button is clicked", async () => {
    const onRefresh = vi.fn();
    const user = userEvent.setup();
    render(
      <Window title="NPCs" onClose={vi.fn()} onRefresh={onRefresh}>
        <p>Body content</p>
      </Window>,
    );

    await user.click(screen.getByRole("button", { name: "Refresh NPCs" }));

    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it("disables the refresh button while loading", () => {
    render(
      <Window title="NPCs" onClose={vi.fn()} onRefresh={vi.fn()} isLoading>
        <p>Body content</p>
      </Window>,
    );

    expect(screen.getByRole("button", { name: "Refresh NPCs" })).toBeDisabled();
  });

  it("does not render a loading overlay by default", () => {
    render(
      <Window title="NPCs" onClose={vi.fn()}>
        <p>Body content</p>
      </Window>,
    );

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("renders a blocking loading overlay when isLoading is true", () => {
    render(
      <Window title="NPCs" onClose={vi.fn()} isLoading>
        <p>Body content</p>
      </Window>,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Loading NPCs");
  });

  it("moves focus to the first focusable body element on mount", () => {
    render(
      <Window title="NPCs" onClose={vi.fn()}>
        <button type="button">First field</button>
      </Window>,
    );

    expect(screen.getByRole("button", { name: "First field" })).toHaveFocus();
  });

  it("falls back to focusing the close button when there's no focusable body content", () => {
    render(
      <Window title="NPCs" onClose={vi.fn()}>
        <p>Body content</p>
      </Window>,
    );

    expect(screen.getByRole("button", { name: "Close NPCs" })).toHaveFocus();
  });

  it("calls onClose when Escape is pressed", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <Window title="NPCs" onClose={onClose}>
        <button type="button">First field</button>
      </Window>,
    );

    await user.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("wraps Tab from the close button back to the first body field", async () => {
    const user = userEvent.setup();
    render(
      <Window title="NPCs" onClose={vi.fn()}>
        <button type="button">First field</button>
      </Window>,
    );

    screen.getByRole("button", { name: "Close NPCs" }).focus();
    await user.tab();

    expect(screen.getByRole("button", { name: "First field" })).toHaveFocus();
  });

  it("restores focus to whatever had it before the window mounted, on unmount", () => {
    function Wrapper({ mounted }: { mounted: boolean }) {
      return (
        <div>
          <button type="button">Opener</button>
          {mounted ? (
            <Window title="NPCs" onClose={vi.fn()}>
              <button type="button">First field</button>
            </Window>
          ) : null}
        </div>
      );
    }

    const { rerender } = render(<Wrapper mounted={false} />);
    screen.getByRole("button", { name: "Opener" }).focus();

    rerender(<Wrapper mounted={true} />);
    expect(screen.getByRole("button", { name: "First field" })).toHaveFocus();

    rerender(<Wrapper mounted={false} />);
    expect(screen.getByRole("button", { name: "Opener" })).toHaveFocus();
  });

  it("does not steal focus on mount when autoFocus is false", () => {
    render(<button type="button">Opener</button>);
    screen.getByRole("button", { name: "Opener" }).focus();

    render(
      <Window title="NPCs" onClose={vi.fn()} autoFocus={false}>
        <button type="button">First field</button>
      </Window>,
    );

    expect(screen.getByRole("button", { name: "Opener" })).toHaveFocus();
  });

  it("still closes on Escape when autoFocus is false", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <Window title="NPCs" onClose={onClose} autoFocus={false}>
        <button type="button">First field</button>
      </Window>,
    );

    screen.getByRole("button", { name: "First field" }).focus();
    await user.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
