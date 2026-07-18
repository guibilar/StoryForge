import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MapCanvas } from "./MapCanvas";

describe("MapCanvas", () => {
  it("renders a pannable/zoomable Leaflet viewport with a tile layer", () => {
    const { container } = render(<MapCanvas />);

    expect(container.querySelector(".leaflet-container")).toBeTruthy();
    expect(container.querySelector(".leaflet-control-zoom-in")).toBeTruthy();
    expect(container.querySelector(".leaflet-control-zoom-out")).toBeTruthy();

    const tile = container.querySelector<HTMLImageElement>(".leaflet-tile");
    expect(tile?.src).toMatch(/tile\.openstreetmap\.org/);
  });

  it("renders tiles for the requested zoom level", () => {
    const { container } = render(<MapCanvas zoom={5} />);

    const tile = container.querySelector<HTMLImageElement>(".leaflet-tile");
    expect(tile?.src).toMatch(/tile\.openstreetmap\.org\/5\//);
  });

  it("centers on the requested coordinates", () => {
    const { container: defaultContainer } = render(<MapCanvas />);
    const { container: customContainer } = render(
      <MapCanvas center={[51.505, -0.09]} zoom={13} />,
    );

    const defaultTile =
      defaultContainer.querySelector<HTMLImageElement>(".leaflet-tile");
    const customTile =
      customContainer.querySelector<HTMLImageElement>(".leaflet-tile");
    expect(customTile?.src).not.toEqual(defaultTile?.src);
  });
});
