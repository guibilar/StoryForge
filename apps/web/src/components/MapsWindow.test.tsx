import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MapsWindow } from "./MapsWindow";

describe("MapsWindow", () => {
  it("renders the map canvas", () => {
    const { container } = render(<MapsWindow />);

    expect(container.querySelector(".leaflet-container")).toBeTruthy();
  });
});
