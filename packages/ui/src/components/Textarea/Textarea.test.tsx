import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it } from "vitest";

import { Textarea } from "./Textarea";

describe("Textarea", () => {
  it("renders with the value the user types", async () => {
    const user = userEvent.setup();
    render(<Textarea aria-label="Recap" />);

    const textarea = screen.getByLabelText("Recap");
    await user.type(textarea, "The party arrived at dusk.");

    expect(textarea).toHaveValue("The party arrived at dusk.");
  });

  it("forwards a ref to the underlying textarea element", () => {
    const ref = createRef<HTMLTextAreaElement>();
    render(<Textarea ref={ref} aria-label="Recap" />);

    expect(ref.current).toBeInstanceOf(HTMLTextAreaElement);
  });
});
