import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";

import { Checkbox } from "./Checkbox";

describe("Checkbox", () => {
  it("renders the label as clickable text", () => {
    render(<Checkbox label="Alice" onChange={() => {}} checked={false} />);

    expect(screen.getByLabelText("Alice")).toBeInTheDocument();
  });

  it("calls onChange when clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Checkbox label="Alice" onChange={onChange} checked={false} />);

    await user.click(screen.getByLabelText("Alice"));

    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("reflects the checked state", () => {
    render(<Checkbox label="Alice" onChange={() => {}} checked />);

    expect(screen.getByLabelText("Alice")).toBeChecked();
  });

  it("forwards a ref to the underlying input element", () => {
    const ref = createRef<HTMLInputElement>();
    render(<Checkbox ref={ref} label="Alice" onChange={() => {}} />);

    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });
});
