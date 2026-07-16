import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it } from "vitest";

import { Input } from "./Input";

describe("Input", () => {
  it("renders with the value the user types", async () => {
    const user = userEvent.setup();
    render(<Input aria-label="Email" />);

    const input = screen.getByLabelText("Email");
    await user.type(input, "a@b.com");

    expect(input).toHaveValue("a@b.com");
  });

  it("sets aria-invalid when invalid is true", () => {
    render(<Input aria-label="Email" invalid />);

    expect(screen.getByLabelText("Email")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  it("omits aria-invalid by default", () => {
    render(<Input aria-label="Email" />);

    expect(screen.getByLabelText("Email")).not.toHaveAttribute("aria-invalid");
  });

  it("forwards a ref to the underlying input element", () => {
    const ref = createRef<HTMLInputElement>();
    render(<Input ref={ref} aria-label="Email" />);

    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });
});
