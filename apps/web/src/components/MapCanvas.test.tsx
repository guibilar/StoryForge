import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import L from "leaflet";

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

  it("recomputes its size when the container is resized", () => {
    const observed: Element[] = [];
    let trigger: (() => void) | undefined;
    const disconnect = vi.fn();
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: () => void) {
          trigger = callback;
        }
        observe(element: Element) {
          observed.push(element);
        }
        disconnect = disconnect;
      },
    );

    const invalidateSize = vi.spyOn(L.Map.prototype, "invalidateSize");
    const { container, unmount } = render(<MapCanvas />);
    const mapEl = container.querySelector<HTMLElement>(".leaflet-container");

    // Desktop windows resize by dragging their own handle, which fires no
    // window resize event — so the observer has to watch the container.
    expect(observed).toContain(mapEl);

    invalidateSize.mockClear();
    trigger!();
    expect(invalidateSize).toHaveBeenCalled();

    unmount();
    expect(disconnect).toHaveBeenCalled();
    invalidateSize.mockRestore();
    vi.unstubAllGlobals();
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

    it("shows no territory toggle without an onCompleteTerritory handler", () => {
      render(<MapCanvas onDrawModeChange={vi.fn()} onPlaceMarker={vi.fn()} />);

      expect(
        screen.queryByRole("button", { name: "Draw territory" }),
      ).not.toBeInTheDocument();
    });

    function drawTerritory(container: HTMLElement, points: number[][]) {
      const map = container.querySelector<HTMLElement>(".leaflet-container");
      for (const [clientX, clientY] of points) {
        fireEvent.click(map!, { clientX, clientY });
      }
      return map!;
    }

    it("emits a closed [lng, lat] polygon when the ring is finished", () => {
      const onCompleteTerritory = vi.fn();
      const { container } = render(
        <MapCanvas
          drawMode="territory"
          onDrawModeChange={vi.fn()}
          onCompleteTerritory={onCompleteTerritory}
        />,
      );

      const map = drawTerritory(container, [
        [100, 80],
        [200, 80],
        [200, 180],
      ]);
      fireEvent.dblClick(map, { clientX: 200, clientY: 180 });

      expect(onCompleteTerritory).toHaveBeenCalledTimes(1);
      const geometry = onCompleteTerritory.mock.calls[0][0];
      expect(geometry.type).toBe("Polygon");

      const ring = geometry.coordinates[0];
      // Three clicked vertices plus the repeated first position.
      expect(ring).toHaveLength(4);
      expect(ring[0]).toEqual(ring[ring.length - 1]);

      // GeoJSON is [lng, lat]: clicking further right raises longitude, and
      // further down lowers latitude. If the pair were swapped, these two
      // assertions would disagree with each other.
      expect(ring[1][0]).toBeGreaterThan(ring[0][0]);
      expect(ring[2][1]).toBeLessThan(ring[1][1]);
    });

    it("does not duplicate vertices when a real double-click closes the ring", () => {
      const onCompleteTerritory = vi.fn();
      const { container } = render(
        <MapCanvas
          drawMode="territory"
          onDrawModeChange={vi.fn()}
          onCompleteTerritory={onCompleteTerritory}
        />,
      );

      // A browser double-click fires click, click, then dblclick — so the
      // final point gets appended twice before the ring is built.
      const map = drawTerritory(container, [
        [100, 80],
        [200, 80],
        [200, 180],
        [200, 180],
      ]);
      fireEvent.dblClick(map, { clientX: 200, clientY: 180 });

      const ring = onCompleteTerritory.mock.calls[0][0].coordinates[0];
      expect(ring).toHaveLength(4);
      expect(ring[2]).not.toEqual(ring[1]);
    });

    it("closes the ring when the first vertex is clicked", () => {
      const onCompleteTerritory = vi.fn();
      const { container } = render(
        <MapCanvas
          drawMode="territory"
          onDrawModeChange={vi.fn()}
          onCompleteTerritory={onCompleteTerritory}
        />,
      );

      drawTerritory(container, [
        [100, 80],
        [200, 80],
        [200, 180],
      ]);

      // The first vertex is the larger circle, rendered before the others.
      const vertexCircles = container.querySelectorAll<SVGElement>(
        "path.leaflet-interactive",
      );
      fireEvent.click(vertexCircles[vertexCircles.length - 3]!);

      expect(onCompleteTerritory).toHaveBeenCalledTimes(1);
      const ring = onCompleteTerritory.mock.calls[0][0].coordinates[0];
      // Closing on the first vertex must not append a fourth point: the ring
      // is the three clicked corners plus the repeated first position.
      expect(ring).toHaveLength(4);
      expect(ring[0]).toEqual(ring[3]);
    });

    it("clears a half-drawn ring on Escape", () => {
      const onDrawModeChange = vi.fn();
      const onCompleteTerritory = vi.fn();
      const { container } = render(
        <MapCanvas
          drawMode="territory"
          onDrawModeChange={onDrawModeChange}
          onCompleteTerritory={onCompleteTerritory}
        />,
      );

      drawTerritory(container, [
        [100, 80],
        [200, 80],
      ]);
      fireEvent.keyDown(document, { key: "Escape" });

      expect(onDrawModeChange).toHaveBeenCalledWith("none");
      expect(
        container.querySelectorAll("path.leaflet-interactive"),
      ).toHaveLength(0);
      expect(onCompleteTerritory).not.toHaveBeenCalled();
    });

    it("leaves Backspace alone while the user is typing in a field", () => {
      const { container } = render(
        <MapCanvas
          drawMode="territory"
          onDrawModeChange={vi.fn()}
          onCompleteTerritory={vi.fn()}
        />,
      );

      drawTerritory(container, [
        [100, 80],
        [200, 80],
      ]);
      const before = container.querySelectorAll(
        "path.leaflet-interactive",
      ).length;

      // A create form opened by an earlier placement is a real place for the
      // cursor to be while the map is still armed.
      const input = document.createElement("input");
      document.body.appendChild(input);
      input.focus();
      fireEvent.keyDown(input, { key: "Backspace" });

      expect(
        container.querySelectorAll("path.leaflet-interactive"),
      ).toHaveLength(before);
      input.remove();
    });

    it("ignores the finish gesture below three vertices", () => {
      const onCompleteTerritory = vi.fn();
      const { container } = render(
        <MapCanvas
          drawMode="territory"
          onDrawModeChange={vi.fn()}
          onCompleteTerritory={onCompleteTerritory}
        />,
      );

      const map = drawTerritory(container, [
        [100, 80],
        [200, 80],
      ]);
      fireEvent.dblClick(map, { clientX: 200, clientY: 80 });

      expect(onCompleteTerritory).not.toHaveBeenCalled();
    });

    it("renders a vertex per click while drawing", () => {
      const { container } = render(
        <MapCanvas
          drawMode="territory"
          onDrawModeChange={vi.fn()}
          onCompleteTerritory={vi.fn()}
        />,
      );

      expect(
        container.querySelectorAll("path.leaflet-interactive"),
      ).toHaveLength(0);

      drawTerritory(container, [[100, 80]]);
      // One vertex circle plus the (still empty) connecting line.
      expect(
        container.querySelectorAll("path.leaflet-interactive"),
      ).toHaveLength(2);

      drawTerritory(container, [[200, 80]]);
      expect(
        container.querySelectorAll("path.leaflet-interactive"),
      ).toHaveLength(3);
    });

    it("undoes the last vertex on Backspace", () => {
      const onCompleteTerritory = vi.fn();
      const { container } = render(
        <MapCanvas
          drawMode="territory"
          onDrawModeChange={vi.fn()}
          onCompleteTerritory={onCompleteTerritory}
        />,
      );

      const map = drawTerritory(container, [
        [100, 80],
        [200, 80],
        [200, 180],
      ]);
      fireEvent.keyDown(document, { key: "Backspace" });
      fireEvent.dblClick(map, { clientX: 200, clientY: 180 });

      // Back down to two vertices, so the finish gesture is refused.
      expect(onCompleteTerritory).not.toHaveBeenCalled();
    });

    it("discards a half-drawn ring when the mode is disarmed", () => {
      const onCompleteTerritory = vi.fn();
      const { container, rerender } = render(
        <MapCanvas
          drawMode="territory"
          onDrawModeChange={vi.fn()}
          onCompleteTerritory={onCompleteTerritory}
        />,
      );

      drawTerritory(container, [
        [100, 80],
        [200, 80],
      ]);

      rerender(
        <MapCanvas
          drawMode="none"
          onDrawModeChange={vi.fn()}
          onCompleteTerritory={onCompleteTerritory}
        />,
      );
      rerender(
        <MapCanvas
          drawMode="territory"
          onDrawModeChange={vi.fn()}
          onCompleteTerritory={onCompleteTerritory}
        />,
      );

      // The earlier points must not still be there — two fresh clicks plus
      // the stale pair would otherwise be enough to close a ring.
      const map = drawTerritory(container, [
        [300, 80],
        [300, 180],
      ]);
      fireEvent.dblClick(map, { clientX: 300, clientY: 180 });

      expect(onCompleteTerritory).not.toHaveBeenCalled();
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
