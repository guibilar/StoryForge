import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";

import { Button } from "./Button";

describe("Button", () => {
  it("renders children and defaults to the primary variant", () => {
    render(<Button>Log in</Button>);

    const button = screen.getByRole("button", { name: "Log in" });
    expect(button.className).toMatch(/primary/);
  });

  it("applies the secondary variant class", () => {
    render(<Button variant="secondary">Cancel</Button>);

    expect(screen.getByRole("button", { name: "Cancel" }).className).toMatch(
      /secondary/,
    );
  });

  it("applies the tab variant class and reflects aria-pressed", () => {
    render(
      <Button variant="tab" aria-pressed>
        Notes
      </Button>,
    );

    const button = screen.getByRole("button", { name: "Notes" });
    expect(button.className).toMatch(/tab/);
    expect(button).toHaveAttribute("aria-pressed", "true");
  });

  it("forwards a ref to the underlying button element", () => {
    const ref = createRef<HTMLButtonElement>();
    render(<Button ref={ref}>Submit</Button>);

    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });

  it("calls onClick when clicked and stays inert when disabled", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <>
        <Button onClick={onClick}>Enabled</Button>
        <Button onClick={onClick} disabled>
          Disabled
        </Button>
      </>,
    );

    await user.click(screen.getByRole("button", { name: "Enabled" }));
    await user.click(screen.getByRole("button", { name: "Disabled" }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
