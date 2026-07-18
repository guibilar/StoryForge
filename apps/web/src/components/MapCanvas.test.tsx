import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MapCanvas } from "./MapCanvas";
import type { MapMarkerPoint, MapTerritoryShape } from "./MapCanvas";

const marker: MapMarkerPoint = {
  id: "marker-1",
  name: "Old Mill",
  lat: 51.505,
  lng: -0.09,
  description: "Abandoned mill on the river.",
};

const territory: MapTerritoryShape = {
  id: "territory-1",
  name: "Thornwood",
  type: "region",
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
        [0, 0],
      ],
    ],
  },
};

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

  it("renders a Leaflet marker icon for each marker", () => {
    const { container } = render(<MapCanvas markers={[marker]} />);

    expect(container.querySelector(".leaflet-marker-icon")).toBeTruthy();
  });

  it("shows the marker's name/description in a popup with Edit/Delete on click", () => {
    const onEditMarker = vi.fn();
    const onDeleteMarker = vi.fn();
    const { container } = render(
      <MapCanvas
        markers={[marker]}
        onEditMarker={onEditMarker}
        onDeleteMarker={onDeleteMarker}
      />,
    );

    const icon = container.querySelector<HTMLElement>(".leaflet-marker-icon");
    expect(icon).toBeTruthy();
    fireEvent.click(icon!);

    expect(screen.getByText("Old Mill")).toBeInTheDocument();
    expect(
      screen.getByText("Abandoned mill on the river."),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(onEditMarker).toHaveBeenCalledWith(marker);

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(onDeleteMarker).toHaveBeenCalledWith(marker);
  });

  it("renders a Leaflet layer for each territory and reports clicks", () => {
    const onTerritoryClick = vi.fn();
    const { container } = render(
      <MapCanvas
        territories={[territory]}
        onTerritoryClick={onTerritoryClick}
      />,
    );

    const shape = container.querySelector<SVGElement>(".leaflet-interactive");
    expect(shape).toBeTruthy();

    fireEvent.click(shape!);
    expect(onTerritoryClick).toHaveBeenCalledWith(territory);
  });
});
