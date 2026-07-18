import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

  it("disables the marker's Edit/Delete buttons while markerActionPending is true", () => {
    const { container } = render(
      <MapCanvas markers={[marker]} markerActionPending />,
    );

    const icon = container.querySelector<HTMLElement>(".leaflet-marker-icon");
    fireEvent.click(icon!);

    expect(screen.getByRole("button", { name: "Edit" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Delete" })).toBeDisabled();
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

  it("renders a custom map image instead of tiles when imageOverlay is set", () => {
    const { container } = render(
      <MapCanvas
        imageOverlay={{
          url: "/uploads/campaign-1/map.png",
          width: 2000,
          height: 1500,
        }}
      />,
    );

    expect(container.querySelector(".leaflet-tile")).toBeFalsy();
    const overlayImage = container.querySelector<HTMLImageElement>(
      ".leaflet-image-layer",
    );
    expect(overlayImage).toBeTruthy();
    expect(overlayImage?.src).toContain("/uploads/campaign-1/map.png");
  });

  it("falls back to the tile layer when imageOverlay is absent", () => {
    const { container } = render(<MapCanvas imageOverlay={null} />);

    expect(container.querySelector(".leaflet-image-layer")).toBeFalsy();
    expect(container.querySelector(".leaflet-tile")).toBeTruthy();
  });

  describe("draw modes", () => {
    it("shows no draw toolbar without the callbacks that drive it", () => {
      render(<MapCanvas />);

      expect(
        screen.queryByRole("button", { name: "Add marker" }),
      ).not.toBeInTheDocument();
    });

    it("arms and disarms marker mode from the toolbar", async () => {
      const user = userEvent.setup();
      const onDrawModeChange = vi.fn();
      const { rerender } = render(
        <MapCanvas
          onDrawModeChange={onDrawModeChange}
          onPlaceMarker={vi.fn()}
        />,
      );

      await user.click(screen.getByRole("button", { name: "Add marker" }));
      expect(onDrawModeChange).toHaveBeenCalledWith("marker");

      rerender(
        <MapCanvas
          drawMode="marker"
          onDrawModeChange={onDrawModeChange}
          onPlaceMarker={vi.fn()}
        />,
      );

      await user.click(screen.getByRole("button", { name: "Cancel" }));
      expect(onDrawModeChange).toHaveBeenLastCalledWith("none");
    });

    it("reports the clicked coordinates only while marker mode is armed", () => {
      const onPlaceMarker = vi.fn();
      const { container, rerender } = render(
        <MapCanvas onDrawModeChange={vi.fn()} onPlaceMarker={onPlaceMarker} />,
      );

      const map = container.querySelector<HTMLElement>(".leaflet-container");
      fireEvent.click(map!, { clientX: 100, clientY: 80 });
      expect(onPlaceMarker).not.toHaveBeenCalled();

      rerender(
        <MapCanvas
          drawMode="marker"
          onDrawModeChange={vi.fn()}
          onPlaceMarker={onPlaceMarker}
        />,
      );
      fireEvent.click(map!, { clientX: 100, clientY: 80 });

      expect(onPlaceMarker).toHaveBeenCalledTimes(1);
      const position = onPlaceMarker.mock.calls[0][0];
      expect(Number.isFinite(position.lat)).toBe(true);
      expect(Number.isFinite(position.lng)).toBe(true);
    });

    it("reports pixel-space coordinates under a custom map image", () => {
      const onPlaceMarker = vi.fn();
      const { container } = render(
        <MapCanvas
          drawMode="marker"
          imageOverlay={{
            url: "/uploads/campaign-1/map.png",
            width: 2000,
            height: 1500,
          }}
          onDrawModeChange={vi.fn()}
          onPlaceMarker={onPlaceMarker}
        />,
      );

      const map = container.querySelector<HTMLElement>(".leaflet-container");
      fireEvent.click(map!, { clientX: 100, clientY: 80 });

      // CRS.Simple means these are offsets into the image, not degrees — the
      // assertion that matters is that they're passed through unclamped.
      expect(onPlaceMarker).toHaveBeenCalledTimes(1);
      const position = onPlaceMarker.mock.calls[0][0];
      expect(Number.isFinite(position.lat)).toBe(true);
      expect(Number.isFinite(position.lng)).toBe(true);
    });

    it("suppresses territory edit clicks while a mode is armed", () => {
      const onTerritoryClick = vi.fn();
      const { container } = render(
        <MapCanvas
          drawMode="marker"
          territories={[territory]}
          onDrawModeChange={vi.fn()}
          onPlaceMarker={vi.fn()}
          onTerritoryClick={onTerritoryClick}
        />,
      );

      const shape = container.querySelector<SVGElement>(".leaflet-interactive");
      fireEvent.click(shape!);

      expect(onTerritoryClick).not.toHaveBeenCalled();
    });

    it("disarms on Escape", () => {
      const onDrawModeChange = vi.fn();
      render(
        <MapCanvas
          drawMode="marker"
          onDrawModeChange={onDrawModeChange}
          onPlaceMarker={vi.fn()}
        />,
      );

      fireEvent.keyDown(document, { key: "Escape" });

      expect(onDrawModeChange).toHaveBeenCalledWith("none");
    });

    it("does not zoom on double-click while armed", () => {
      const { container } = render(
        <MapCanvas
          drawMode="marker"
          onDrawModeChange={vi.fn()}
          onPlaceMarker={vi.fn()}
        />,
      );

      const map = container.querySelector<HTMLElement>(".leaflet-container");
      const initialTile =
        container.querySelector<HTMLImageElement>(".leaflet-tile")?.src;

      // Double-click is KAN-115's "close the ring" gesture; if it still
      // zoomed, the tile URLs would change to the next zoom level.
      fireEvent.dblClick(map!, { clientX: 100, clientY: 80 });

      expect(
        container.querySelector<HTMLImageElement>(".leaflet-tile")?.src,
      ).toEqual(initialTile);
    });
  });
});
