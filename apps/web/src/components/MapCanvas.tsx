import { useEffect } from "react";
import type { LatLngBoundsExpression, LatLngExpression } from "leaflet";
import L from "leaflet";
import type { GeoJsonObject } from "geojson";
import {
  GeoJSON,
  ImageOverlay,
  MapContainer,
  Marker,
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
  // Lights up the "Add marker" toggle. A mode whose handler isn't wired gets
  // no button at all, so the toolbar never shows a control that does nothing
  // — that's how territory drawing stays invisible until KAN-115 lands.
  onPlaceMarker?: (position: MapPosition) => void;
  onEditMarker?: (marker: MapMarkerPoint) => void;
  onDeleteMarker?: (marker: MapMarkerPoint) => void;
  onTerritoryClick?: (territory: MapTerritoryShape) => void;
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
}: {
  drawMode: MapDrawMode;
  onDrawModeChange?: (mode: MapDrawMode) => void;
  onPlaceMarker?: (position: MapPosition) => void;
}) {
  const map = useMapEvents({
    click(event) {
      if (drawMode === "marker") {
        onPlaceMarker?.({ lat: event.latlng.lat, lng: event.latlng.lng });
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
        onDrawModeChange?.("none");
      }
    }
    // Bound to the document rather than the map container so Escape works
    // without the map having focus — the user's attention is on the cursor.
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [drawMode, onDrawModeChange]);

  return null;
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

  function toggleDrawMode(mode: MapDrawMode) {
    onDrawModeChange?.(drawMode === mode ? "none" : mode);
  }

  return (
    <div className={styles.wrap}>
      {canDrawMarker ? (
        <div className={styles.toolbar}>
          <Button
            type="button"
            variant={drawMode === "marker" ? "primary" : "secondary"}
            aria-pressed={drawMode === "marker"}
            onClick={() => toggleDrawMode("marker")}
          >
            {drawMode === "marker" ? "Cancel" : "Add marker"}
          </Button>
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
