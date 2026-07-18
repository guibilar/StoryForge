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

export interface MapCanvasProps {
  center?: LatLngExpression;
  zoom?: number;
  markers?: MapMarkerPoint[];
  territories?: MapTerritoryShape[];
  imageOverlay?: MapImageOverlay | null;
  onEditMarker?: (marker: MapMarkerPoint) => void;
  onDeleteMarker?: (marker: MapMarkerPoint) => void;
  onTerritoryClick?: (territory: MapTerritoryShape) => void;
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

  return (
    <div className={styles.wrap}>
      <MapContainer
        // Leaflet's `crs` is fixed at map creation and can't be swapped on a
        // live instance — keying on the image overlay's presence/identity
        // forces a full remount whenever a custom map image is added,
        // replaced, or removed, instead of silently keeping the wrong CRS.
        key={imageOverlay ? `image:${imageOverlay.url}` : "tiles"}
        {...viewportProps}
        scrollWheelZoom
        className={styles.map}
      >
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
              click: () => onTerritoryClick?.(territory),
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
                    onClick={() => onEditMarker?.(marker)}
                  >
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
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
