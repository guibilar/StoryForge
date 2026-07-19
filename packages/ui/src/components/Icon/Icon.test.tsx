import { render, screen } from "@testing-library/react";
import { Search } from "lucide-react";
import { describe, expect, it } from "vitest";

import { Icon } from "./Icon";

describe("Icon", () => {
  it("renders the given lucide icon with the default size and stroke width", () => {
    render(<Icon icon={Search} data-testid="icon" />);

    const svg = screen.getByTestId("icon");
    expect(svg).toHaveAttribute("width", "18");
    expect(svg).toHaveAttribute("height", "18");
    expect(svg).toHaveAttribute("stroke-width", "1.75");
  });

  it("forwards overrides for size, stroke width, and other svg props", () => {
    render(<Icon icon={Search} data-testid="icon" size={32} strokeWidth={2} />);

    const svg = screen.getByTestId("icon");
    expect(svg).toHaveAttribute("width", "32");
    expect(svg).toHaveAttribute("height", "32");
    expect(svg).toHaveAttribute("stroke-width", "2");
  });
});
