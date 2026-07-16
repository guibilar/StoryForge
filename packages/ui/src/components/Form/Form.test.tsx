import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Form } from "./Form";

describe("Form", () => {
  it("calls onSubmit when submitted", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());

    render(
      <Form onSubmit={onSubmit} aria-label="test form">
        <button type="submit">Submit</button>
      </Form>,
    );

    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
