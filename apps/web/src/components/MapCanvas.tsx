import type { LatLngExpression } from "leaflet";
import { MapContainer, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";

import styles from "./MapCanvas.module.css";

// Placeholder viewport — no campaign has real map data yet (KAN-51/52), so
// this just needs to be a stable, reasonable default rather than a
// meaningful location.
const DEFAULT_CENTER: LatLngExpression = [20, 0];
const DEFAULT_ZOOM = 3;

export interface MapCanvasProps {
  center?: LatLngExpression;
  zoom?: number;
}

// Base Leaflet canvas: pan/zoom + tile layer only, no domain/GraphQL data.
// KAN-51 (markers/territories) and KAN-52 (image overlays) render their
// layers as children of this component's <MapContainer> once they land.
export function MapCanvas({
  center = DEFAULT_CENTER,
  zoom = DEFAULT_ZOOM,
}: MapCanvasProps) {
  return (
    <div className={styles.wrap}>
      <MapContainer
        center={center}
        zoom={zoom}
        scrollWheelZoom
        className={styles.map}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
      </MapContainer>
    </div>
  );
}
