import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FormActions } from "./FormActions";

describe("FormActions", () => {
  it("renders its children", () => {
    render(
      <FormActions>
        <button type="button">Cancel</button>
        <button type="submit">Save</button>
      </FormActions>,
    );

    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });

  it("merges a custom className with the base styles", () => {
    render(<FormActions className="extra" data-testid="actions" />);

    const actions = screen.getByTestId("actions");
    expect(actions.className).toContain("extra");
  });
});
