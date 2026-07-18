import { useEffect, useRef, useState } from "react";
import type { LatLngBoundsExpression, LatLngExpression } from "leaflet";
import L from "leaflet";
import type { GeoJsonObject } from "geojson";
import {
  CircleMarker,
  GeoJSON,
  ImageOverlay,
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  useMapEvents,
} from "react-leaflet";
import { Button } from "@storyforge/ui";
import "leaflet/dist/leaflet.css";

import markerIconUrl from "leaflet/dist/images/marker-icon.png";
import markerIcon2xUrl from "leaflet/dist/images/marker-icon-2x.png";
import markerShadowUrl from "leaflet/dist/images/marker-shadow.png";

import styles from "./MapCanvas.module.css";

// Leaflet's default marker icon references image paths relative to the
// package itself (works with a plain <script> tag, not a bundler) — without
// this fix every marker renders as a broken image under Vite.
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })
  ._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIconUrl,
  iconRetinaUrl: markerIcon2xUrl,
  shadowUrl: markerShadowUrl,
});

// Placeholder viewport — no campaign has real map data yet, so this just
// needs to be a stable, reasonable default rather than a meaningful location.
const DEFAULT_CENTER: LatLngExpression = [20, 0];
const DEFAULT_ZOOM = 3;

export interface MapMarkerPoint {
  id: string;
  name: string;
  lat: number;
  lng: number;
  description?: string | null;
}

export interface MapTerritoryShape {
  id: string;
  name: string;
  type: string;
  geometry: Record<string, unknown>;
  description?: string | null;
}

export interface MapImageOverlay {
  url: string;
  width: number;
  height: number;
}

export interface MapPosition {
  lat: number;
  lng: number;
}

// Which authoring gesture the map is currently armed for (KAN-113). The mode
// is owned by the caller rather than this component so that placing a marker
// can disarm it as a side effect of opening a form — MapCanvas only reports
// what the user did with it.
export type MapDrawMode = "none" | "marker" | "territory";

export interface MapCanvasProps {
  center?: LatLngExpression;
  zoom?: number;
  markers?: MapMarkerPoint[];
  territories?: MapTerritoryShape[];
  imageOverlay?: MapImageOverlay | null;
  // Disables every marker popup's Edit/Delete buttons while a delete is in
  // flight, so a slow response can't be raced by a second click.
  markerActionPending?: boolean;
  drawMode?: MapDrawMode;
  // Presence of this callback is what makes the draw toolbar appear — only
  // campaign writers get one, mirroring how onTerritoryClick already gates
  // territory editing.
  onDrawModeChange?: (mode: MapDrawMode) => void;
  // Each of these lights up its own toolbar toggle. A mode whose handler
  // isn't wired gets no button, so the toolbar never shows a control that
  // does nothing.
  onPlaceMarker?: (position: MapPosition) => void;
  // Receives a closed GeoJSON Polygon once the user finishes drawing.
  onCompleteTerritory?: (geometry: Record<string, unknown>) => void;
  onEditMarker?: (marker: MapMarkerPoint) => void;
  onDeleteMarker?: (marker: MapMarkerPoint) => void;
  onTerritoryClick?: (territory: MapTerritoryShape) => void;
}

// A polygon needs three corners; below that the finish gesture is ignored
// rather than emitting a degenerate shape.
const MIN_POLYGON_VERTICES = 3;

// A browser double-click fires click, click, dblclick — so the point the user
// finished on has already been appended twice by the time the ring is built.
// Dropping consecutive duplicates keeps that out of the geometry, and means
// the vertex count that matters is the deduplicated one.
function distinctVertices(vertices: MapPosition[]): MapPosition[] {
  return vertices.filter((vertex, index) => {
    const previous = vertices[index - 1];
    return (
      !previous || previous.lat !== vertex.lat || previous.lng !== vertex.lng
    );
  });
}

// GeoJSON positions are [longitude, latitude] — the reverse of Leaflet's
// LatLng — and a linear ring must repeat its first position as its last.
// Both are silent failures if got wrong: the shape saves fine and then
// renders somewhere unexpected, or not at all.
function polygonFrom(vertices: MapPosition[]): Record<string, unknown> {
  const ring = vertices.map((vertex) => [vertex.lng, vertex.lat]);
  ring.push([vertices[0].lng, vertices[0].lat]);

  return { type: "Polygon", coordinates: [ring] };
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT"
  );
}

// react-leaflet only exposes map-level events to children of MapContainer,
// so the click handling for draw modes has to live in its own component
// rather than in the MapCanvas body.
//
// Coordinates are passed through exactly as Leaflet reports them: geographic
// degrees under the tile layer, but pixel offsets into the image under a
// custom map image (CRS.Simple — see the viewport comment below). Marker
// validation accepts both, so there is nothing to normalize here.
function MapDrawLayer({
  drawMode,
  onDrawModeChange,
  onPlaceMarker,
  onCompleteTerritory,
}: {
  drawMode: MapDrawMode;
  onDrawModeChange?: (mode: MapDrawMode) => void;
  onPlaceMarker?: (position: MapPosition) => void;
  onCompleteTerritory?: (geometry: Record<string, unknown>) => void;
}) {
  // The ref is the source of truth and the state only drives rendering:
  // Leaflet fires both `click`s of a double-click before `dblclick`, so
  // reading vertices from a render-time closure would miss the last points.
  const verticesRef = useRef<MapPosition[]>([]);
  const [vertices, setVertices] = useState<MapPosition[]>([]);

  function setRing(ring: MapPosition[]) {
    verticesRef.current = ring;
    setVertices(ring);
  }

  function finishTerritory() {
    const ring = distinctVertices(verticesRef.current);
    if (ring.length < MIN_POLYGON_VERTICES) {
      return;
    }
    setRing([]);
    onCompleteTerritory?.(polygonFrom(ring));
  }

  const map = useMapEvents({
    click(event) {
      const position = { lat: event.latlng.lat, lng: event.latlng.lng };

      if (drawMode === "marker") {
        onPlaceMarker?.(position);
        return;
      }

      if (drawMode === "territory") {
        setRing([...verticesRef.current, position]);
      }
    },
    dblclick() {
      if (drawMode === "territory") {
        // Both clicks of the double-click have already appended their
        // vertices, so the ring is whatever has accumulated.
        finishTerritory();
      }
    },
  });

  // Double-click is the "close the ring" gesture while drawing a territory
  // (KAN-115), so its default zoom behaviour has to be off for as long as any
  // mode is armed. Leaflet handlers are imperative — react-leaflet won't
  // re-apply the MapContainer prop after mount, so toggle it directly.
  useEffect(() => {
    if (drawMode === "none") {
      map.doubleClickZoom.enable();
    } else {
      map.doubleClickZoom.disable();
    }
  }, [drawMode, map]);

  useEffect(() => {
    if (drawMode === "none") {
      return;
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setRing([]);
        onDrawModeChange?.("none");
        return;
      }
      // Undo the last vertex. Backspace would otherwise navigate back in
      // some browsers, so this has to claim the event — but only when the
      // user isn't typing: a create form from an earlier placement can still
      // be open and focused while the map stays armed, and eating its
      // Backspace would make that field impossible to edit.
      if (
        event.key === "Backspace" &&
        verticesRef.current.length > 0 &&
        !isTypingTarget(event.target)
      ) {
        event.preventDefault();
        setRing(verticesRef.current.slice(0, -1));
      }
    }
    // Bound to the document rather than the map container so the shortcuts
    // work without the map having focus — the user's attention is on the
    // cursor, and Leaflet's container isn't focusable by default.
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [drawMode, onDrawModeChange]);

  // Leaving territory mode by any other route (toolbar toggle, a mode switch)
  // must not strand a half-drawn ring for the next time it's armed.
  useEffect(() => {
    if (drawMode !== "territory" && verticesRef.current.length > 0) {
      setRing([]);
    }
  }, [drawMode]);

  if (drawMode !== "territory" || vertices.length === 0) {
    return null;
  }

  const first = vertices[0];

  return (
    <>
      {/* Closes the shape visually while drawing so the user sees the polygon
          they'll get, without committing the ring until they finish. */}
      <Polyline
        positions={
          vertices.length >= MIN_POLYGON_VERTICES
            ? [...vertices, first]
            : vertices
        }
        dashArray="6 6"
      />
      {vertices.map((vertex, index) => (
        <CircleMarker
          key={`${vertex.lat},${vertex.lng},${index}`}
          center={vertex}
          radius={index === 0 ? 7 : 5}
          eventHandlers={
            // Clicking the first vertex closes the ring. Propagation has to
            // stop here or the map's own click handler appends a duplicate
            // of that first point before the ring is built.
            index === 0
              ? {
                  click: (event) => {
                    L.DomEvent.stopPropagation(event);
                    finishTerritory();
                  },
                }
              : undefined
          }
        />
      ))}
    </>
  );
}

function boundsFor(image: MapImageOverlay): LatLngBoundsExpression {
  return [
    [0, 0],
    [image.height, image.width],
  ];
}

// Base Leaflet canvas: pan/zoom + tile layer, plus markers/territories
// rendered as Leaflet layers on top (KAN-51). Domain/GraphQL fetching and
// mutation wiring live in MapsWindow, not here — this stays a presentational
// primitive other surfaces (e.g. an entity's "show on map" link) can reuse.
export function MapCanvas({
  center = DEFAULT_CENTER,
  zoom = DEFAULT_ZOOM,
  markers = [],
  territories = [],
  imageOverlay = null,
  markerActionPending = false,
  drawMode = "none",
  onDrawModeChange,
  onPlaceMarker,
  onCompleteTerritory,
  onEditMarker,
  onDeleteMarker,
  onTerritoryClick,
}: MapCanvasProps) {
  // A custom map image (KAN-52) replaces the geographic tile layer: it
  // switches to Leaflet's CRS.Simple (plain x/y pixel space, no geographic
  // projection) and initializes the viewport from the image's own bounds
  // instead of a center/zoom pair, so it's fully visible on first render
  // rather than requiring the caller to guess a zoom level.
  const viewportProps = imageOverlay
    ? { crs: L.CRS.Simple, bounds: boundsFor(imageOverlay) }
    : { center, zoom };

  const drawing = drawMode !== "none";
  const canDrawMarker = Boolean(onDrawModeChange && onPlaceMarker);
  const canDrawTerritory = Boolean(onDrawModeChange && onCompleteTerritory);

  function toggleDrawMode(mode: MapDrawMode) {
    onDrawModeChange?.(drawMode === mode ? "none" : mode);
  }

  return (
    <div className={styles.wrap}>
      {canDrawMarker || canDrawTerritory ? (
        <div className={styles.toolbar}>
          {canDrawMarker ? (
            <Button
              type="button"
              variant={drawMode === "marker" ? "primary" : "secondary"}
              aria-pressed={drawMode === "marker"}
              onClick={() => toggleDrawMode("marker")}
            >
              {drawMode === "marker" ? "Cancel" : "Add marker"}
            </Button>
          ) : null}
          {canDrawTerritory ? (
            <Button
              type="button"
              variant={drawMode === "territory" ? "primary" : "secondary"}
              aria-pressed={drawMode === "territory"}
              onClick={() => toggleDrawMode("territory")}
            >
              {drawMode === "territory" ? "Cancel" : "Draw territory"}
            </Button>
          ) : null}
        </div>
      ) : null}
      <MapContainer
        // Leaflet's `crs` is fixed at map creation and can't be swapped on a
        // live instance — keying on the image overlay's presence/identity
        // forces a full remount whenever a custom map image is added,
        // replaced, or removed, instead of silently keeping the wrong CRS.
        key={imageOverlay ? `image:${imageOverlay.url}` : "tiles"}
        {...viewportProps}
        scrollWheelZoom
        className={drawing ? `${styles.map} ${styles.drawing}` : styles.map}
      >
        <MapDrawLayer
          drawMode={drawMode}
          onDrawModeChange={onDrawModeChange}
          onPlaceMarker={onPlaceMarker}
          onCompleteTerritory={onCompleteTerritory}
        />
        {imageOverlay ? (
          <ImageOverlay
            url={imageOverlay.url}
            bounds={boundsFor(imageOverlay)}
          />
        ) : (
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
        )}
        {territories.map((territory) => (
          <GeoJSON
            key={territory.id}
            data={territory.geometry as unknown as GeoJsonObject}
            eventHandlers={{
              // While a mode is armed, a click that lands on an existing
              // territory is the user placing a point on top of it — not a
              // request to edit that territory.
              click: () => {
                if (!drawing) {
                  onTerritoryClick?.(territory);
                }
              },
            }}
          />
        ))}
        {markers.map((marker) => (
          <Marker key={marker.id} position={[marker.lat, marker.lng]}>
            <Popup>
              <div className={styles.popup}>
                <strong>{marker.name}</strong>
                {marker.description ? <p>{marker.description}</p> : null}
                <div className={styles.popupActions}>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={markerActionPending}
                    onClick={() => onEditMarker?.(marker)}
                  >
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={markerActionPending}
                    onClick={() => onDeleteMarker?.(marker)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
