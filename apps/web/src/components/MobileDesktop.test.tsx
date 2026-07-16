import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { MobileDesktop } from "./MobileDesktop";

describe("MobileDesktop", () => {
  it("shows the first catalog window's panel by default", () => {
    render(<MobileDesktop />);

    expect(screen.getByRole("heading", { name: "NPCs" })).toBeInTheDocument();
    expect(screen.getByText("Coming soon — KAN-39.")).toBeInTheDocument();
  });

  it("switches panels when a tab is clicked", async () => {
    const user = userEvent.setup();
    render(<MobileDesktop />);

    await user.click(screen.getByRole("button", { name: "Notes" }));

    expect(screen.getByRole("heading", { name: "Notes" })).toBeInTheDocument();
    expect(screen.getByText("Coming soon — KAN-85.")).toBeInTheDocument();
    expect(screen.queryByText("Coming soon — KAN-39.")).not.toBeInTheDocument();
  });

  it("marks the active tab with aria-pressed", async () => {
    const user = userEvent.setup();
    render(<MobileDesktop />);

    await user.click(screen.getByRole("button", { name: "Sessions" }));

    expect(screen.getByRole("button", { name: "Sessions" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "NPCs" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });
});
