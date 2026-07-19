import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { Trash2 } from "lucide-react";
import { describe, expect, it, vi } from "vitest";

import { IconButton } from "./IconButton";

describe("IconButton", () => {
  it("takes its accessible name from label and defaults to secondary", () => {
    render(<IconButton icon={Trash2} label="Delete note" />);

    const button = screen.getByRole("button", { name: "Delete note" });
    expect(button.className).toMatch(/secondary/);
    expect(button).toHaveAttribute("title", "Delete note");
  });

  it("applies the danger variant class", () => {
    render(<IconButton icon={Trash2} label="Delete" variant="danger" />);

    expect(screen.getByRole("button", { name: "Delete" }).className).toMatch(
      /danger/,
    );
  });

  it("defaults to type=button so it never submits a surrounding form", () => {
    render(<IconButton icon={Trash2} label="Delete" />);

    expect(screen.getByRole("button", { name: "Delete" })).toHaveAttribute(
      "type",
      "button",
    );
  });

  it("forwards a ref to the underlying button element", () => {
    const ref = createRef<HTMLButtonElement>();
    render(<IconButton ref={ref} icon={Trash2} label="Delete" />);

    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });

  it("calls onClick when clicked and stays inert when disabled", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <>
        <IconButton icon={Trash2} label="Enabled" onClick={onClick} />
        <IconButton icon={Trash2} label="Disabled" onClick={onClick} disabled />
      </>,
    );

    await user.click(screen.getByRole("button", { name: "Enabled" }));
    await user.click(screen.getByRole("button", { name: "Disabled" }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
