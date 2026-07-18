import { useRef } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { useFocusTrap } from "./focusTrap";

function Harness({
  onEscape,
  withBodyField = true,
  autoFocus = true,
}: {
  onEscape: () => void;
  withBodyField?: boolean;
  autoFocus?: boolean;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const handleKeyDown = useFocusTrap(rootRef, onEscape, autoFocus);

  return (
    <div>
      <button type="button">Sibling outside the trap</button>
      <div ref={rootRef} tabIndex={-1} onKeyDown={handleKeyDown}>
        <button type="button">Chrome button</button>
        {withBodyField ? (
          <div data-window-body>
            <input aria-label="First field" />
            <input aria-label="Last field" />
          </div>
        ) : null}
      </div>
    </div>
  );
}

describe("useFocusTrap", () => {
  it("moves focus into the container's body content on mount", () => {
    render(<Harness onEscape={vi.fn()} />);

    expect(screen.getByLabelText("First field")).toHaveFocus();
  });

  it("falls back to the first focusable chrome element when there's no body content", () => {
    render(<Harness onEscape={vi.fn()} withBodyField={false} />);

    expect(screen.getByRole("button", { name: "Chrome button" })).toHaveFocus();
  });

  it("calls onEscape when Escape is pressed", async () => {
    const onEscape = vi.fn();
    const user = userEvent.setup();
    render(<Harness onEscape={onEscape} />);

    await user.keyboard("{Escape}");

    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it("wraps Tab from the last focusable element back to the first", async () => {
    const user = userEvent.setup();
    render(<Harness onEscape={vi.fn()} />);

    screen.getByLabelText("Last field").focus();
    await user.tab();

    expect(screen.getByRole("button", { name: "Chrome button" })).toHaveFocus();
  });

  it("wraps Shift+Tab from the first focusable element back to the last", async () => {
    const user = userEvent.setup();
    render(<Harness onEscape={vi.fn()} />);

    screen.getByRole("button", { name: "Chrome button" }).focus();
    await user.tab({ shift: true });

    expect(screen.getByLabelText("Last field")).toHaveFocus();
  });

  it("restores focus to the previously-focused element on unmount", () => {
    function Wrapper({ mounted }: { mounted: boolean }) {
      return (
        <div>
          <button type="button">Outside trigger</button>
          {mounted ? <Harness onEscape={vi.fn()} /> : null}
        </div>
      );
    }

    const { rerender } = render(<Wrapper mounted={false} />);
    screen.getByRole("button", { name: "Outside trigger" }).focus();
    expect(
      screen.getByRole("button", { name: "Outside trigger" }),
    ).toHaveFocus();

    rerender(<Wrapper mounted={true} />);
    expect(screen.getByLabelText("First field")).toHaveFocus();

    rerender(<Wrapper mounted={false} />);
    expect(
      screen.getAllByRole("button", { name: "Outside trigger" })[0],
    ).toHaveFocus();
  });

  it("does not move focus on mount when autoFocus is false, but Escape still works", async () => {
    const onEscape = vi.fn();
    const user = userEvent.setup();
    render(<button type="button">Elsewhere</button>);
    screen.getByRole("button", { name: "Elsewhere" }).focus();

    render(<Harness onEscape={onEscape} autoFocus={false} />);

    expect(screen.getByRole("button", { name: "Elsewhere" })).toHaveFocus();

    screen.getByLabelText("First field").focus();
    await user.keyboard("{Escape}");

    expect(onEscape).toHaveBeenCalledTimes(1);
  });
});
