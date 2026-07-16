import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FormField } from "./FormField";

describe("FormField", () => {
  it("associates the label with its input via htmlFor/id", () => {
    render(
      <FormField label="Email" htmlFor="email">
        <input id="email" />
      </FormField>,
    );

    expect(screen.getByLabelText("Email")).toBeInTheDocument();
  });

  it("renders the error message with role alert when present", () => {
    render(
      <FormField label="Email" htmlFor="email" error="Invalid email">
        <input id="email" />
      </FormField>,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Invalid email");
  });

  it("omits the alert when there is no error", () => {
    render(
      <FormField label="Email" htmlFor="email">
        <input id="email" />
      </FormField>,
    );

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
