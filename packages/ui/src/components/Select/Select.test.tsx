import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it } from "vitest";

import { Select } from "./Select";

describe("Select", () => {
  it("selects the option the user picks", async () => {
    const user = userEvent.setup();
    render(
      <Select aria-label="Role" defaultValue="PLAYER">
        <option value="PLAYER">Player</option>
        <option value="GM">GM</option>
      </Select>,
    );

    const select = screen.getByLabelText("Role");
    await user.selectOptions(select, "GM");

    expect(select).toHaveValue("GM");
  });

  it("forwards a ref to the underlying select element", () => {
    const ref = createRef<HTMLSelectElement>();
    render(
      <Select ref={ref} aria-label="Role">
        <option value="PLAYER">Player</option>
      </Select>,
    );

    expect(ref.current).toBeInstanceOf(HTMLSelectElement);
  });
});
