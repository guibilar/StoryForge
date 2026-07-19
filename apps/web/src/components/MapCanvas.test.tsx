import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import L from "leaflet";

import { MapCanvas } from "./MapCanvas";
import { fitTerritoryLabel, isInsideRings } from "./mapLabels";
import type { LabelPoint } from "./mapLabels";
import type { MapMarkerPoint, MapTerritoryShape } from "./MapCanvas";

// Territory labels are sized from the shape's on-screen pixel extents, so the
// fixture polygon has to be zoomed in far enough to clear the minimum legible
// font size — at the default zoom a 1° square is a few pixels across.
const LABEL_ZOOM = 8;

// Stand-in for a measured string: jsdom has no canvas, so MapCanvas falls back
// to a per-character estimate and these mirror it for "Thornwood".
const TEXT = { width: 9 * 0.68, length: 9 };

const square = (size: number): LabelPoint[] => [
  { x: 0, y: 0 },
  { x: size, y: 0 },
  { x: size, y: size },
  { x: 0, y: size },
];

// Fits a label into rings given in plain pixel space, which is what the fitting
// works in — the lat/lng mapping is the identity here so the geometry under
// test stays readable.
const fitIn = (rings: LabelPoint[][], text = TEXT) =>
  fitTerritoryLabel(rings, (point) => ({ lat: point.y, lng: point.x }), text);

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

function mockMatchMedia(matches: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

describe("MapCanvas", () => {
  afterEach(() => {
    document.documentElement.removeAttribute("data-theme");
    vi.unstubAllGlobals();
  });

  it("renders a pannable/zoomable Leaflet viewport with a tile layer", () => {
    const { container } = render(<MapCanvas />);

    expect(container.querySelector(".leaflet-container")).toBeTruthy();
    expect(container.querySelector(".leaflet-control-zoom-in")).toBeTruthy();
    expect(container.querySelector(".leaflet-control-zoom-out")).toBeTruthy();

    const tile = container.querySelector<HTMLImageElement>(".leaflet-tile");
    expect(tile?.src).toMatch(/basemaps\.cartocdn\.com\/light_all/);
  });

  it("renders tiles for the requested zoom level", () => {
    const { container } = render(<MapCanvas zoom={5} />);

    const tile = container.querySelector<HTMLImageElement>(".leaflet-tile");
    expect(tile?.src).toMatch(/light_all\/5\//);
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
        editing
        onEditMarker={onEditMarker}
        onDeleteMarker={onDeleteMarker}
      />,
    );

    const icon = container.querySelector<HTMLElement>(".leaflet-marker-icon");
    expect(icon).toBeTruthy();
    fireEvent.click(icon!);

    // Scoped to the popup: the marker's name is also on the map itself as its
    // permanent label, so a bare text query matches twice.
    expect(container.querySelector(".leaflet-popup")?.textContent).toContain(
      "Old Mill",
    );
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
      <MapCanvas markers={[marker]} editing markerActionPending />,
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
        editing
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

  describe("theming", () => {
    it("uses the dark basemap when the OS prefers dark", () => {
      mockMatchMedia(true);

      const { container } = render(<MapCanvas />);

      const tile = container.querySelector<HTMLImageElement>(".leaflet-tile");
      expect(tile?.src).toMatch(/basemaps\.cartocdn\.com\/dark_all/);
    });

    it("prefers an explicit [data-theme] over the OS preference", () => {
      mockMatchMedia(true);
      document.documentElement.dataset.theme = "light";

      const { container } = render(<MapCanvas />);

      const tile = container.querySelector<HTMLImageElement>(".leaflet-tile");
      expect(tile?.src).toMatch(/basemaps\.cartocdn\.com\/light_all/);
    });

    it("switches the basemap when the theme changes after mount", async () => {
      mockMatchMedia(false);

      const { container } = render(<MapCanvas />);
      expect(
        container.querySelector<HTMLImageElement>(".leaflet-tile")?.src,
      ).toMatch(/light_all/);

      document.documentElement.dataset.theme = "dark";

      await waitFor(() =>
        expect(
          container.querySelector<HTMLImageElement>(".leaflet-tile")?.src,
        ).toMatch(/dark_all/),
      );
    });
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
          editing
          onDrawModeChange={onDrawModeChange}
          onPlaceMarker={vi.fn()}
        />,
      );

      await user.click(screen.getByRole("button", { name: "Add marker" }));
      expect(onDrawModeChange).toHaveBeenCalledWith("marker");

      rerender(
        <MapCanvas
          editing
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
          editing
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

  describe("entity colouring", () => {
    function markerWithEntity(type: string | null) {
      return {
        ...marker,
        entity: type
          ? {
              id: "e-1",
              name: "Riverwood",
              type,
              category: "LOCATION",
              visibility: "PUBLIC",
            }
          : null,
      };
    }

    function pinFill(container: HTMLElement): string | null {
      return (
        container
          .querySelector(".leaflet-marker-icon svg path")
          ?.getAttribute("fill") ?? null
      );
    }

    it("gives markers of the same entity type the same colour", () => {
      const { container: a } = render(
        <MapCanvas markers={[markerWithEntity("city")]} />,
      );
      const { container: b } = render(
        <MapCanvas
          markers={[{ ...markerWithEntity("city"), id: "marker-2" }]}
        />,
      );

      expect(pinFill(a)).toBe(pinFill(b));
    });

    it("gives different entity types different colours", () => {
      const { container: city } = render(
        <MapCanvas markers={[markerWithEntity("city")]} />,
      );
      const { container: dungeon } = render(
        <MapCanvas markers={[markerWithEntity("dungeon")]} />,
      );

      expect(pinFill(city)).not.toBe(pinFill(dungeon));
    });

    it("leaves unlinked markers the neutral default", () => {
      const { container: unlinked } = render(
        <MapCanvas markers={[markerWithEntity(null)]} />,
      );
      const { container: linked } = render(
        <MapCanvas markers={[markerWithEntity("city")]} />,
      );

      expect(pinFill(unlinked)).toBe("#3388ff");
      expect(pinFill(linked)).not.toBe("#3388ff");
    });

    it("colours a territory by its linked entity type", () => {
      const { container } = render(
        <MapCanvas
          territories={[
            {
              ...territory,
              entity: {
                id: "e-1",
                name: "R",
                type: "city",
                category: "LOCATION",
                visibility: "PUBLIC",
              },
            },
          ]}
        />,
      );

      const shape = container.querySelector("path.leaflet-interactive");
      expect(shape?.getAttribute("stroke")).not.toBe("#3388ff");
    });

    it("prefers the entity's own color over the type-derived one", () => {
      const { container } = render(
        <MapCanvas
          markers={[
            {
              ...marker,
              entity: {
                id: "e-1",
                name: "Riverwood",
                type: "city",
                category: "LOCATION",
                color: "#ff00ff",
                visibility: "PUBLIC",
              },
            },
          ]}
        />,
      );

      expect(pinFill(container)).toBe("#ff00ff");
    });

    it("names the linked entity in the marker popup", () => {
      const { container } = render(
        <MapCanvas markers={[markerWithEntity("city")]} />,
      );

      fireEvent.click(
        container.querySelector<HTMLElement>(".leaflet-marker-icon")!,
      );

      expect(screen.getByText(/Riverwood/)).toBeInTheDocument();
    });
  });

  describe("view mode", () => {
    const linked = {
      id: "e-1",
      name: "Riverwood",
      type: "city",
      category: "LOCATION",
      visibility: "PUBLIC",
    };

    it("hides the edit toolbar's draw tools until editing is turned on", async () => {
      const user = userEvent.setup();
      const onEditingChange = vi.fn();
      render(
        <MapCanvas
          onEditingChange={onEditingChange}
          onDrawModeChange={vi.fn()}
          onPlaceMarker={vi.fn()}
        />,
      );

      expect(
        screen.queryByRole("button", { name: "Add marker" }),
      ).not.toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Edit map" }));
      expect(onEditingChange).toHaveBeenCalledWith(true);
    });

    it("offers no marker Edit/Delete outside edit mode", () => {
      const { container } = render(<MapCanvas markers={[marker]} />);

      fireEvent.click(
        container.querySelector<HTMLElement>(".leaflet-marker-icon")!,
      );

      // Scoped to the popup: the marker's name is also on the map itself as
      // its permanent label, so a bare text query matches twice.
      expect(container.querySelector(".leaflet-popup")?.textContent).toContain(
        "Old Mill",
      );
      expect(
        screen.queryByRole("button", { name: "Edit" }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Delete" }),
      ).not.toBeInTheDocument();
    });

    it("opens the linked entity from a marker popup instead of the edit form", () => {
      const onOpenEntity = vi.fn();
      const onEditMarker = vi.fn();
      const { container } = render(
        <MapCanvas
          markers={[{ ...marker, entity: linked }]}
          onOpenEntity={onOpenEntity}
          onEditMarker={onEditMarker}
        />,
      );

      fireEvent.click(
        container.querySelector<HTMLElement>(".leaflet-marker-icon")!,
      );
      fireEvent.click(screen.getByRole("button", { name: /Riverwood/ }));

      expect(onOpenEntity).toHaveBeenCalledWith(linked);
      expect(onEditMarker).not.toHaveBeenCalled();
    });

    it("shows a territory popup instead of opening its edit form", () => {
      const onTerritoryClick = vi.fn();
      const onOpenEntity = vi.fn();
      const { container } = render(
        <MapCanvas
          territories={[{ ...territory, entity: linked }]}
          onTerritoryClick={onTerritoryClick}
          onOpenEntity={onOpenEntity}
        />,
      );

      fireEvent.click(
        container.querySelector<SVGElement>("path.leaflet-interactive")!,
      );

      // Territories had no popup at all before — clicking always jumped
      // straight to the edit form.
      expect(onTerritoryClick).not.toHaveBeenCalled();
      expect(screen.getByText("Thornwood")).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: /Riverwood/ }));
      expect(onOpenEntity).toHaveBeenCalledWith(linked);
    });

    it("still opens the edit form for a territory while editing", () => {
      const onTerritoryClick = vi.fn();
      const { container } = render(
        <MapCanvas
          editing
          territories={[territory]}
          onTerritoryClick={onTerritoryClick}
        />,
      );

      fireEvent.click(
        container.querySelector<SVGElement>("path.leaflet-interactive")!,
      );

      expect(onTerritoryClick).toHaveBeenCalledWith(territory);
    });
  });

  describe("territory labels", () => {
    it("labels a territory with its linked entity's name", () => {
      const { container } = render(
        <MapCanvas
          zoom={LABEL_ZOOM}
          territories={[
            {
              ...territory,
              entity: {
                id: "e-1",
                name: "Riverwood",
                type: "city",
                category: "LOCATION",
                visibility: "PUBLIC",
              },
            },
          ]}
        />,
      );

      // Uppercased for the map, and measured that way too so the fit matches
      // the glyphs that get drawn.
      expect(container.querySelector(".leaflet-tooltip")?.textContent).toBe(
        "RIVERWOOD",
      );
    });

    it("falls back to the territory's own name when unlinked", () => {
      const { container } = render(
        <MapCanvas zoom={LABEL_ZOOM} territories={[territory]} />,
      );

      expect(container.querySelector(".leaflet-tooltip")?.textContent).toBe(
        "THORNWOOD",
      );
    });

    it("sizes the label to the shape: wider gets bigger text", () => {
      const small = fitIn([square(120)])!;
      const large = fitIn([square(240)])!;

      expect(large.fontSize).toBeGreaterThan(small.fontSize);
    });

    it("spends leftover width on letter-spacing once the font size caps out", () => {
      // A long, thin shape: the font size is limited by how narrow it is, so
      // the text is stretched across the length instead of just growing.
      const fit = fitIn([
        [
          { x: 0, y: 0 },
          { x: 600, y: 0 },
          { x: 600, y: 24 },
          { x: 0, y: 24 },
        ],
      ])!;

      expect(fit.fontSize).toBeLessThan(40);
      expect(fit.letterSpacing).toBeGreaterThan(0);
    });

    it("fills the available width exactly, so the text can't overrun the shape", () => {
      const width = 600;
      const fit = fitIn([
        [
          { x: 0, y: 0 },
          { x: width, y: 0 },
          { x: width, y: 24 },
          { x: 0, y: 24 },
        ],
      ])!;

      // What the browser will actually lay out: the glyphs plus one gap
      // between each pair of them.
      const laidOut =
        fit.fontSize * TEXT.width + fit.letterSpacing * (TEXT.length - 1);

      expect(laidOut).toBeLessThanOrEqual(width);
    });

    it("writes along an arm rather than from the elbow it is deepest in", () => {
      // An L. Its deepest interior point is the elbow, where the text is boxed
      // in on two sides; either arm holds it several times bigger.
      const elbow = [
        { x: 0, y: 0 },
        { x: 300, y: 0 },
        { x: 300, y: 80 },
        { x: 80, y: 80 },
        { x: 80, y: 300 },
        { x: 0, y: 300 },
      ];

      const fit = fitIn([elbow])!;

      // Down an arm, not across the corner.
      expect(Math.abs(fit.angleDeg)).toBe(90);
      // The elbow itself only fits ~14px; an arm fits more than twice that.
      expect(fit.fontSize).toBeGreaterThan(28);
    });

    it("keeps the text horizontal in a shape with no long axis", () => {
      // A square has marginally more room along its diagonal, but tilting the
      // name for that reads as a bug rather than as a fit.
      expect(fitIn([square(300)])!.angleDeg).toBe(0);
    });

    it("rotates the label onto the territory's long axis", () => {
      // A diagonal sliver running north-east: the name should follow it
      // rather than sit horizontally across the shape.
      const diagonal = {
        ...territory,
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [0, 0],
              [0.1, 0],
              [4, 4],
              [3.9, 4],
              [0, 0],
            ],
          ],
        },
      };

      const { container } = render(
        <MapCanvas zoom={LABEL_ZOOM} territories={[diagonal]} />,
      );

      const angle = Number.parseFloat(
        container
          .querySelector<HTMLElement>('[data-testid="territory-label"]')!
          .style.transform.replace(/[^-\d.]/g, ""),
      );
      // Roughly -45°: screen y grows downwards, so a north-east shape tilts
      // the text up to the right.
      expect(angle).toBeLessThan(-20);
      expect(angle).toBeGreaterThan(-70);
    });

    it("resizes the label live as the map is zoomed, not just on mount", () => {
      const { container } = render(
        <MapCanvas zoom={LABEL_ZOOM} territories={[territory]} />,
      );

      const fontSize = () =>
        Number.parseFloat(
          container.querySelector<HTMLElement>(
            '[data-testid="territory-label"]',
          )!.style.fontSize,
        );
      const before = fontSize();

      // Drive a real zoom through Leaflet's own control rather than
      // remounting at a different zoom — this is what would catch the label
      // never resubscribing to zoom changes.
      fireEvent.click(
        container.querySelector<HTMLElement>(".leaflet-control-zoom-in")!,
      );

      // Zooming in makes the shape bigger on screen, so its name grows too.
      expect(fontSize()).toBeGreaterThan(before);
    });

    it("keeps the label inside a concave territory, not in its bay", () => {
      // A C-shape opening east. Its centroid falls in the bay — outside the
      // territory — so a centroid-anchored label would float on empty map.
      const ring = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 20 },
        { x: 20, y: 20 },
        { x: 20, y: 80 },
        { x: 100, y: 80 },
        { x: 100, y: 100 },
        { x: 0, y: 100 },
      ];

      expect(isInsideRings({ x: 60, y: 50 }, [ring])).toBe(false);

      const fit = fitIn([ring])!;

      expect(
        isInsideRings({ x: fit.center.lng, y: fit.center.lat }, [ring]),
      ).toBe(true);
    });

    it("sizes to the room inside the shape, not to its bounding box", () => {
      // Same C-shape: the box around it is 100 wide, but the arm the label
      // ends up in is only 20 across.
      const ring = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 20 },
        { x: 20, y: 20 },
        { x: 20, y: 80 },
        { x: 100, y: 80 },
        { x: 100, y: 100 },
        { x: 0, y: 100 },
      ];

      // A bounding-box measurement would size this like the solid square it
      // sits in, rather than like the 20px-wide arm the label ends up in.
      expect(fitIn([ring])!.fontSize).toBeLessThan(
        fitIn([square(100)])!.fontSize,
      );
    });

    it("fades the label in as it grows, reaching full opacity when readable", () => {
      const faint = fitIn([square(70)])!;
      const clearer = fitIn([square(110)])!;
      const full = fitIn([square(400)])!;

      expect(faint.opacity).toBeGreaterThan(0);
      expect(faint.opacity).toBeLessThan(clearer.opacity);
      expect(clearer.opacity).toBeLessThan(1);
      expect(full.opacity).toBe(1);
    });

    it("fades the label back out once its territory outgrows the screen", () => {
      // One shape, three window sizes: at some point you have zoomed so far
      // into the territory that its name is no longer labelling anything you
      // can see.
      const shape = [square(1000)];
      const fitOn = (width: number, height: number) =>
        fitTerritoryLabel(
          shape,
          (point) => ({ lat: point.y, lng: point.x }),
          TEXT,
          { width, height },
        );

      // Comfortably larger than the shape: nothing to fade for.
      expect(fitOn(2000, 2000)!.opacity).toBe(1);

      // Zoomed in far enough that the shape runs well past the window.
      const fading = fitOn(600, 600)!;
      expect(fading.opacity).toBeGreaterThan(0);
      expect(fading.opacity).toBeLessThan(1);

      // Further still, and the label is gone rather than faint.
      expect(fitOn(300, 300)).toBeNull();
    });

    it("keeps labels while the map has no measured size yet", () => {
      // Before layout the viewport reads 0x0, which would make every shape
      // infinitely oversized and blank the map's labels on first paint.
      expect(
        fitTerritoryLabel(
          [square(200)],
          (point) => ({ lat: point.y, lng: point.x }),
          TEXT,
          { width: 0, height: 0 },
        ),
      ).not.toBeNull();
    });

    it("drops the label entirely when the shape is too small to read it in", () => {
      // Below the legibility floor there is no font size that works, so the
      // label is omitted rather than rendered as an illegible smudge.
      expect(fitIn([square(20)])).toBeNull();
    });

    it("labels a MultiPolygon by all its parts, not just the first", () => {
      const multi = {
        ...territory,
        geometry: {
          type: "MultiPolygon",
          coordinates: [
            [
              [
                [0, 0],
                [2, 0],
                [2, 2],
                [0, 0],
              ],
            ],
            [
              [
                [10, 10],
                [12, 10],
                [12, 12],
                [10, 10],
              ],
            ],
          ],
        },
      };
      const { container } = render(
        <MapCanvas zoom={LABEL_ZOOM} territories={[multi]} />,
      );

      // Renders at all — the first-ring-only version produced a label box
      // around island one instead of the whole feature.
      expect(container.querySelector(".leaflet-tooltip")?.textContent).toBe(
        "THORNWOOD",
      );
    });

    it("renders no label for geometry with no usable coordinates", () => {
      const { container } = render(
        <MapCanvas
          zoom={LABEL_ZOOM}
          territories={[
            {
              ...territory,
              geometry: { type: "Polygon", coordinates: [] },
            },
          ]}
        />,
      );

      expect(container.querySelector(".leaflet-tooltip")).toBeNull();
      expect(
        container.querySelector('[data-testid="territory-label"]'),
      ).toBeNull();
    });

    it("hides territory names behind the toolbar toggle", async () => {
      const user = userEvent.setup();
      render(<MapCanvas zoom={LABEL_ZOOM} territories={[territory]} />);

      expect(screen.getByTestId("territory-label")).toBeTruthy();

      await user.click(
        screen.getByRole("button", { name: "Toggle territory names" }),
      );

      expect(screen.queryByTestId("territory-label")).toBeNull();
    });
  });

  describe("marker labels", () => {
    it("shows a marker's name on the map", () => {
      render(<MapCanvas markers={[marker]} />);

      expect(screen.getByTestId("marker-label").textContent).toBe("Old Mill");
    });

    it("hides the markers themselves behind the toolbar toggle", async () => {
      const user = userEvent.setup();
      const { container } = render(<MapCanvas markers={[marker]} />);

      expect(container.querySelector(".leaflet-marker-icon")).toBeTruthy();

      await user.click(screen.getByRole("button", { name: "Toggle markers" }));

      expect(container.querySelector(".leaflet-marker-icon")).toBeNull();
      // The pin's name goes with it rather than being left floating.
      expect(screen.queryByTestId("marker-label")).toBeNull();
      // Nothing left to name, so that toggle is out of reach.
      expect(
        screen.getByRole("button", { name: "Toggle marker names" }),
      ).toBeDisabled();
    });

    it("hides marker names behind the toolbar toggle", async () => {
      const user = userEvent.setup();
      render(<MapCanvas markers={[marker]} />);

      await user.click(
        screen.getByRole("button", { name: "Toggle marker names" }),
      );

      expect(screen.queryByTestId("marker-label")).toBeNull();
    });
  });

  // KAN-130: MapCanvas's live-view plumbing — reporting the mounted map's own
  // center/zoom out, and applying an externally-pushed one in. No
  // subscription/mutation is wired here (that's KAN-129/131); these tests
  // only cover the two hooks themselves.
  describe("live viewport (KAN-130)", () => {
    // Drags the map by firing a real Leaflet mousedown/mousemove/mouseup
    // sequence on the container. Leaflet's Draggable computes movement from
    // the events' own clientX/clientY deltas rather than layout, and the
    // move/mouseup have to be dispatched on the map element (not `document`)
    // — Leaflet reads `event.target` off them to tag the drag target, and a
    // `document`-targeted event blows that up.
    function dragMap(
      map: HTMLElement,
      from: [number, number],
      to: [number, number],
    ) {
      const buttons = { button: 0, which: 1 };
      fireEvent.mouseDown(map, {
        clientX: from[0],
        clientY: from[1],
        ...buttons,
      });
      fireEvent.mouseMove(map, { clientX: to[0], clientY: to[1], ...buttons });
      fireEvent.mouseUp(map, { clientX: to[0], clientY: to[1], ...buttons });
    }

    it("reports the initial center/zoom on mount", () => {
      const onViewportChange = vi.fn();
      render(
        <MapCanvas
          center={[51.505, -0.09]}
          zoom={7}
          onViewportChange={onViewportChange}
        />,
      );

      expect(onViewportChange).toHaveBeenCalledWith({
        center: { lat: 51.505, lng: -0.09 },
        zoom: 7,
      });
    });

    it("reports the live center once panning settles (moveend/dragend)", () => {
      const onViewportChange = vi.fn();
      const { container } = render(
        <MapCanvas
          center={[51.505, -0.09]}
          zoom={5}
          onViewportChange={onViewportChange}
        />,
      );
      const map = container.querySelector<HTMLElement>(".leaflet-container")!;

      onViewportChange.mockClear();
      dragMap(map, [200, 200], [260, 240]);

      expect(onViewportChange).toHaveBeenCalled();
      const reported = onViewportChange.mock.calls.at(-1)![0];
      // The map has genuinely panned — a different center than what was
      // mounted with — while the zoom, untouched by a drag, stays put.
      expect(reported.center.lat).not.toBeCloseTo(51.505, 3);
      expect(reported.zoom).toBe(5);
    });

    it("does not report a live center without onViewportChange wired", () => {
      // Absence of the callback is what MapViewportWatcher itself has to
      // guard — this only proves dragging without it doesn't throw.
      const { container } = render(
        <MapCanvas center={[51.505, -0.09]} zoom={5} />,
      );
      const map = container.querySelector<HTMLElement>(".leaflet-container")!;

      expect(() => dragMap(map, [200, 200], [260, 240])).not.toThrow();
    });

    it("applies an inbound viewport to the mounted map via setView", () => {
      const setView = vi.spyOn(L.Map.prototype, "setView");
      const { rerender } = render(
        <MapCanvas center={[0, 0]} zoom={3} viewport={null} />,
      );
      setView.mockClear();

      rerender(
        <MapCanvas
          center={[0, 0]}
          zoom={3}
          viewport={{ center: { lat: 12, lng: 34 }, zoom: 9 }}
        />,
      );

      expect(setView).toHaveBeenCalledWith([12, 34], 9);
      setView.mockRestore();
    });

    it("applies a viewport supplied at initial mount too", () => {
      const setView = vi.spyOn(L.Map.prototype, "setView");

      render(
        <MapCanvas
          center={[0, 0]}
          zoom={3}
          viewport={{ center: { lat: 12, lng: 34 }, zoom: 9 }}
        />,
      );

      expect(setView).toHaveBeenCalledWith([12, 34], 9);
      setView.mockRestore();
    });

    it("does not reapply the same external viewport value on every render", () => {
      const setView = vi.spyOn(L.Map.prototype, "setView");
      const viewport = { center: { lat: 12, lng: 34 }, zoom: 9 };
      const { rerender } = render(
        <MapCanvas center={[0, 0]} zoom={3} viewport={viewport} />,
      );
      setView.mockClear();

      // A fresh object with identical values — the common case of a parent
      // re-rendering without memoizing the prop — must not count as a new
      // external command.
      rerender(
        <MapCanvas
          center={[0, 0]}
          zoom={3}
          viewport={{ center: { lat: 12, lng: 34 }, zoom: 9 }}
        />,
      );

      expect(setView).not.toHaveBeenCalled();
      setView.mockRestore();
    });

    it("does not let the user's own subsequent panning get overridden by a stale viewport", () => {
      const setView = vi.spyOn(L.Map.prototype, "setView");
      const viewport = { center: { lat: 12, lng: 34 }, zoom: 9 };
      const { container, rerender } = render(
        <MapCanvas center={[0, 0]} zoom={3} viewport={viewport} />,
      );
      const map = container.querySelector<HTMLElement>(".leaflet-container")!;
      setView.mockClear();

      // The user pans manually after the one-shot jump landed.
      dragMap(map, [200, 200], [260, 240]);
      setView.mockClear();

      // The parent re-renders for an unrelated reason, handing back the same
      // external viewport it already applied once — this must not snap the
      // map back to it.
      rerender(<MapCanvas center={[0, 0]} zoom={3} viewport={viewport} />);

      expect(setView).not.toHaveBeenCalled();
      setView.mockRestore();
    });

    it("applies a new external viewport once it genuinely changes", () => {
      const setView = vi.spyOn(L.Map.prototype, "setView");
      const { rerender } = render(
        <MapCanvas
          center={[0, 0]}
          zoom={3}
          viewport={{ center: { lat: 12, lng: 34 }, zoom: 9 }}
        />,
      );
      setView.mockClear();

      rerender(
        <MapCanvas
          center={[0, 0]}
          zoom={3}
          viewport={{ center: { lat: 55, lng: 66 }, zoom: 11 }}
        />,
      );

      expect(setView).toHaveBeenCalledWith([55, 66], 11);
      setView.mockRestore();
    });
  });
});
