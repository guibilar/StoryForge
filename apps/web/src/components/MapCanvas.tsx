import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import { Button } from "@storyforge/ui";
import "leaflet/dist/leaflet.css";

import { fitTerritoryLabel, ringsIn } from "./mapLabels";
import { useColorScheme } from "../hooks/useColorScheme";
import type { ColorScheme } from "../hooks/useColorScheme";

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

// Mirrors EntitySummary (EntityWindow.tsx) so a popup's entity link can open
// the real entity window without a second fetch — this has to carry the same
// fields EntityWindow needs (image, category, color), or opening an entity
// from the map silently drops them (it used to, for image).
export interface MapLinkedEntity {
  id: string;
  name: string;
  type: string;
  category: string;
  description?: string | null;
  image?: string | null;
  // A user-set override for this entity's marker/territory colour. Falls
  // back to colorForEntityType(type) when unset (see resolveFeatureColor).
  color?: string | null;
  visibility: string;
}

export interface MapMarkerPoint {
  id: string;
  name: string;
  lat: number;
  lng: number;
  description?: string | null;
  entity?: MapLinkedEntity | null;
}

export interface MapTerritoryShape {
  id: string;
  name: string;
  type: string;
  geometry: Record<string, unknown>;
  description?: string | null;
  entity?: MapLinkedEntity | null;
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

// The live camera of a mounted map: where it's centered and how far zoomed
// in. Symmetric in both directions (KAN-130) — `onViewportChange` reports it
// out (e.g. a Storyteller's map broadcasting what they're currently looking
// at), `viewport` pushes one in (e.g. a player's map snapping to it). Neither
// direction is wired to a subscription/mutation here — that's KAN-129/131,
// built on top of this plumbing.
export interface MapViewport {
  center: MapPosition;
  zoom: number;
}

// Which authoring gesture the map is currently armed for (KAN-113). The mode
// is owned by the caller rather than this component so that placing a marker
// can disarm it as a side effect of opening a form — MapCanvas only reports
// what the user did with it.
export type MapDrawMode = "none" | "marker" | "territory";

export interface MapCanvasProps {
  center?: LatLngExpression;
  zoom?: number;
  // Reports the mounted map's live center/zoom whenever a pan or zoom
  // settles — the outward half of KAN-130's live-view plumbing. `center`/
  // `zoom` above only seed the *initial* view (react-leaflet never re-applies
  // them after mount); this is how a caller finds out where the map has
  // moved to since.
  onViewportChange?: (viewport: MapViewport) => void;
  // Pushes a center/zoom to imperatively apply to the already-mounted map —
  // the inward half of KAN-130's live-view plumbing (e.g. snapping a
  // player's map to a Storyteller's). Applied once per genuinely new value
  // (compared to the last one applied, not every render) via `setView`, so
  // it's a one-shot "jump to this view" rather than a continuous lock: the
  // user's own panning afterward is left alone.
  viewport?: MapViewport | null;
  markers?: MapMarkerPoint[];
  territories?: MapTerritoryShape[];
  imageOverlay?: MapImageOverlay | null;
  // Disables every marker popup's Edit/Delete buttons while a delete is in
  // flight, so a slow response can't be raced by a second click.
  markerActionPending?: boolean;
  // Editing is opt-in (view mode is the default): in view mode clicking a
  // feature explains it, in edit mode clicking it changes it. Keeps reading
  // the map during play free of accidental edits.
  editing?: boolean;
  onEditingChange?: (editing: boolean) => void;
  // Opens the world-data window for a feature's linked entity.
  onOpenEntity?: (entity: MapLinkedEntity) => void;
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

// Colour comes from the linked entity's *type*, not the entity itself, so all
// cities share one colour and the map stays readable at a glance — and so it
// lines up with filtering by type later. Hand-picked rather than generated:
// these stay distinguishable from each other and from Leaflet's default blue,
// which is what unlinked features keep (KAN-116).
const ENTITY_TYPE_COLORS = [
  "#c2410c",
  "#15803d",
  "#7e22ce",
  "#b91c1c",
  "#0f766e",
  "#a16207",
  "#be185d",
  "#1d4ed8",
];

const UNLINKED_COLOR = "#3388ff";

// OSM's own tile server has only ever served one, light style — there's no
// url param or style switch that makes it render dark. CARTO's Positron/Dark
// Matter basemaps are built from the same OSM data and need no API key, so
// swapping the tile source itself is what lets the map follow the app's
// theme rather than staying light no matter what.
const TILE_URL: Record<ColorScheme, string> = {
  light: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
  dark: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
};

const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

// Stable across reloads and independent of load order: the same type always
// lands on the same colour, which a running counter or index-into-the-list
// wouldn't guarantee once entities are added or removed.
function colorForEntityType(type: string | null | undefined): string {
  if (!type) {
    return UNLINKED_COLOR;
  }

  let hash = 0;
  for (let index = 0; index < type.length; index += 1) {
    hash = (hash * 31 + type.charCodeAt(index)) | 0;
  }

  return ENTITY_TYPE_COLORS[Math.abs(hash) % ENTITY_TYPE_COLORS.length];
}

// A user-set Entity.color always wins — it's a deliberate choice to make a
// specific location/organization stand out or group visually. The type hash
// is only a fallback for entities nobody has coloured yet.
function resolveFeatureColor(entity: MapLinkedEntity | null | undefined) {
  return entity?.color ?? colorForEntityType(entity?.type);
}

// Leaflet's default marker is a fixed-colour PNG sprite, so tinting it means
// drawing our own. A teardrop path keeps the familiar pin silhouette and
// anchors at the point rather than the centre.
function pinIcon(color: string): L.DivIcon {
  return L.divIcon({
    className: "",
    html: `<svg width="25" height="41" viewBox="0 0 25 41" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M12.5 0C5.6 0 0 5.6 0 12.5C0 21.9 12.5 41 12.5 41S25 21.9 25 12.5C25 5.6 19.4 0 12.5 0Z" fill="${color}" stroke="#ffffff" stroke-width="1.5"/>
      <circle cx="12.5" cy="12.5" r="4.5" fill="#ffffff"/>
    </svg>`,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [0, -36],
    // A DivIcon has no tooltip anchor of its own, so without this the name
    // label would sit at the pin's tip instead of above its head.
    tooltipAnchor: [0, -34],
  });
}

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

// Leaflet caches its container's pixel dimensions and only recomputes them on
// a window resize. Desktop windows here are resized by dragging their own
// handle (useDesktopWindowsController), which fires no window event — so
// without this the map keeps rendering at its original size inside a resized
// window: grey gutters when grown, clipped tiles when shrunk.
function MapResizeWatcher() {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();
    const observer = new ResizeObserver(() => {
      map.invalidateSize();
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [map]);

  return null;
}

// Must match `.territoryLabel span` in MapCanvas.module.css — the fit is only
// correct if the string is measured in the font it is drawn in.
const LABEL_FONT = "600 100px system-ui, sans-serif";
// Measuring at 100px and dividing keeps the cache key independent of size:
// text width scales linearly with font size.
const MEASURE_SIZE = 100;

const labelWidthCache = new Map<string, number>();

// Resolved once, not per measurement: jsdom has no canvas and logs a warning
// for every attempt, and a browser that refused once will refuse again.
let measuringContext: CanvasRenderingContext2D | null | undefined;

function labelMeasuringContext(): CanvasRenderingContext2D | null {
  if (measuringContext === undefined) {
    measuringContext = document.createElement("canvas").getContext("2d");
    if (measuringContext) {
      measuringContext.font = LABEL_FONT;
    }
  }
  return measuringContext;
}

// Width of `text` at font-size 1, from the real font. A per-character estimate
// was close enough to size text but not to *fill* a shape with it: the leftover
// width is spent on letter-spacing, so the estimate's error ends up outside the
// territory rather than absorbed. Cached because this runs for every territory
// on every zoom, and the answer only depends on the string.
function measureLabelWidth(text: string): number {
  const cached = labelWidthCache.get(text);
  if (cached !== undefined) {
    return cached;
  }

  const context = labelMeasuringContext();
  // No canvas (jsdom, or a browser refusing the context): fall back to a
  // per-character estimate for uppercase text in a semibold face. Labels come
  // out slightly mis-sized rather than not at all.
  const width = context
    ? context.measureText(text).width / MEASURE_SIZE
    : text.length * 0.68;

  labelWidthCache.set(text, width);
  return width;
}

// A territory's name written across the shape, sized and rotated to fit it.
// Uses a permanent Tooltip rather than a DivIcon Marker so it can't be clicked
// and never steals the territory's own click.
function TerritoryLabel({
  territory,
  view,
}: {
  territory: MapTerritoryShape;
  // Passed in rather than read here: one subscription for the map beats one
  // per territory, which would fire N re-renders on every zoomend.
  view: MapView;
}) {
  const map = useMap();

  // The entity name when linked, since that's the world-data thing the shape
  // stands for; the territory's own name otherwise, so nothing is anonymous.
  // Uppercased here rather than only in CSS: the fit is measured against the
  // glyphs that will actually be drawn, and capitals are appreciably wider.
  const label = (territory.entity?.name ?? territory.name).toUpperCase();

  const fit = useMemo(
    () =>
      fitTerritoryLabel(
        ringsIn(territory.geometry).map((ring) =>
          ring.map((position) =>
            map.latLngToLayerPoint([position.lat, position.lng]),
          ),
        ),
        (point) => {
          const latLng = map.layerPointToLatLng([point.x, point.y]);
          return { lat: latLng.lat, lng: latLng.lng };
        },
        { width: measureLabelWidth(label), length: label.length },
        { width: view.width, height: view.height },
      ),
    // `view.zoom` is deliberately a dependency the body doesn't read: the
    // pixel measurements come from the map's projection, which the linter
    // can't see changing. Dropping it would freeze every label at its
    // mount-time size.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [map, territory.geometry, label, view.zoom, view.width, view.height],
  );

  if (!fit) {
    return null;
  }

  // The sizing lives on an inner span, not on the Tooltip itself:
  // react-leaflet binds tooltip options once and never re-applies them, so a
  // label styled through the tooltip would keep its mount-time size forever
  // while the map zoomed. Children are ordinary React content and do
  // re-render. The tooltip box itself is styled transparent, so this is
  // visually equivalent.
  return (
    <Tooltip
      permanent
      direction="center"
      position={[fit.center.lat, fit.center.lng]}
      className={styles.territoryLabel}
      interactive={false}
    >
      <span
        data-testid="territory-label"
        style={{
          fontSize: `${fit.fontSize}px`,
          letterSpacing: `${fit.letterSpacing}px`,
          marginRight: `${-fit.letterSpacing}px`,
          transform: `rotate(${fit.angleDeg}deg)`,
          opacity: fit.opacity,
        }}
      >
        {label}
      </span>
    </Tooltip>
  );
}

// Shared popup body for a marker or territory in view mode. The entity link
// is a button rather than an anchor: it opens a desktop window, not a URL.
function FeatureDetails({
  name,
  subtitle,
  description,
  entity,
  onOpenEntity,
}: {
  name: string;
  subtitle?: string;
  description?: string | null;
  entity?: MapLinkedEntity | null;
  onOpenEntity?: (entity: MapLinkedEntity) => void;
}) {
  return (
    <div className={styles.details}>
      <strong>{name}</strong>
      {subtitle ? <span className={styles.entityTag}>{subtitle}</span> : null}
      {description ? <p>{description}</p> : null}
      {entity ? (
        onOpenEntity ? (
          <button
            type="button"
            className={styles.entityLink}
            onClick={() => onOpenEntity(entity)}
          >
            {entity.name} · {entity.type}
          </button>
        ) : (
          <span className={styles.entityTag}>
            {entity.name} · {entity.type}
          </span>
        )
      ) : null}
    </div>
  );
}

// What a territory label's measurements depend on: the projection scale, and
// how much screen there is to judge the shape against.
export interface MapView {
  zoom: number;
  width: number;
  height: number;
}

// One subscription for the whole map, feeding every territory label. Resize
// counts as well as zoom — a label that hides once its territory outgrows the
// window has to reconsider when the window changes size.
function MapViewWatcher({ onChange }: { onChange: (view: MapView) => void }) {
  const map = useMap();

  const report = useCallback(() => {
    const size = map.getSize();
    onChange({ zoom: map.getZoom(), width: size.x, height: size.y });
  }, [map, onChange]);

  useEffect(report, [report]);

  useMapEvents({
    zoomend: report,
    resize: report,
  });

  return null;
}

// Outward half of KAN-130's live-view plumbing: reports the map's live
// center/zoom to whoever is listening (e.g. a Storyteller broadcasting their
// current view, KAN-129/131). Deliberately separate from MapViewWatcher
// above — that one's `onChange` is wired to MapCanvas's own internal `view`
// state purely for territory-label sizing, and never reaches a caller.
// `moveend` covers every pan/zoom that settles (including a `dragend`'s own
// trailing moveend), so subscribing to `dragend` too doesn't add coverage —
// it's still listed alongside `moveend` because that's the pair the ticket
// asks this to report on, and a second call with identical values is
// harmless.
function MapViewportWatcher({
  onChange,
}: {
  onChange?: (viewport: MapViewport) => void;
}) {
  const map = useMap();

  const report = useCallback(() => {
    if (!onChange) {
      return;
    }
    const center = map.getCenter();
    onChange({
      center: { lat: center.lat, lng: center.lng },
      zoom: map.getZoom(),
    });
  }, [map, onChange]);

  useEffect(report, [report]);

  useMapEvents({
    moveend: report,
    dragend: report,
  });

  return null;
}

// Inward half of KAN-130's live-view plumbing: applies an externally-pushed
// center/zoom to the already-mounted map. `viewport` is compared by value
// against the last one this component itself applied (not against the map's
// current live position) — so a re-render that hands back the same values in
// a freshly-allocated object doesn't reapply, and doesn't stomp on wherever
// the user has since panned to. Only a genuinely new incoming value triggers
// another `setView` — a one-shot "jump to this view", not a continuously
// enforced camera lock.
function MapViewportApplier({ viewport }: { viewport?: MapViewport | null }) {
  const map = useMap();
  const appliedRef = useRef<MapViewport | undefined>(undefined);

  useEffect(() => {
    if (!viewport) {
      return;
    }
    const applied = appliedRef.current;
    if (
      applied &&
      applied.zoom === viewport.zoom &&
      applied.center.lat === viewport.center.lat &&
      applied.center.lng === viewport.center.lng
    ) {
      return;
    }
    appliedRef.current = viewport;
    map.setView([viewport.center.lat, viewport.center.lng], viewport.zoom);
  }, [map, viewport]);

  return null;
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
  onViewportChange,
  viewport,
  markers = [],
  territories = [],
  imageOverlay = null,
  markerActionPending = false,
  editing = false,
  onEditingChange,
  onOpenEntity,
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

  const colorScheme = useColorScheme();
  const [view, setView] = useState<MapView>({ zoom, width: 0, height: 0 });
  // Both on by default — a map you can't read the names on is the worse
  // starting point. The toggles are for when the labels get in the way of the
  // shapes themselves.
  const [showTerritoryNames, setShowTerritoryNames] = useState(true);
  const [showMarkers, setShowMarkers] = useState(true);
  const [showMarkerNames, setShowMarkerNames] = useState(true);

  const drawing = drawMode !== "none";
  // Draw tools exist only while editing — the toggle is what reveals them.
  const canDrawMarker = editing && Boolean(onDrawModeChange && onPlaceMarker);
  const canDrawTerritory =
    editing && Boolean(onDrawModeChange && onCompleteTerritory);
  const canEdit = Boolean(onEditingChange);

  function toggleDrawMode(mode: MapDrawMode) {
    onDrawModeChange?.(drawMode === mode ? "none" : mode);
  }

  return (
    <div className={styles.wrap}>
      {/* The label toggles are always available — reading the map is not a
          permission — so the toolbar always renders. The edit toggle and the
          draw tools are independently wired on top of it. */}
      <div className={styles.toolbar}>
        <div className={styles.labelToggles}>
          {/* Icon-sized rather than full buttons: these are view preferences
              sitting next to actions, and shouldn't compete with them. */}
          <button
            type="button"
            className={styles.labelToggle}
            aria-pressed={showTerritoryNames}
            title="Toggle territory names"
            aria-label="Toggle territory names"
            onClick={() => setShowTerritoryNames((shown) => !shown)}
          >
            ▭
          </button>
          <button
            type="button"
            className={styles.labelToggle}
            aria-pressed={showMarkers}
            title="Toggle markers"
            aria-label="Toggle markers"
            onClick={() => setShowMarkers((shown) => !shown)}
          >
            ⚲
          </button>
          <button
            type="button"
            className={styles.labelToggle}
            aria-pressed={showMarkerNames}
            title="Toggle marker names"
            aria-label="Toggle marker names"
            // Names of hidden markers are not a thing to toggle — leaving it
            // live would let the user flip a control with no visible effect.
            disabled={!showMarkers}
            onClick={() => setShowMarkerNames((shown) => !shown)}
          >
            ◉
          </button>
        </div>
        {canEdit ? (
          <Button
            type="button"
            variant={editing ? "primary" : "secondary"}
            aria-pressed={editing}
            onClick={() => onEditingChange?.(!editing)}
          >
            {editing ? "Done editing" : "Edit map"}
          </Button>
        ) : null}
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
        <MapResizeWatcher />
        <MapViewWatcher onChange={setView} />
        <MapViewportWatcher onChange={onViewportChange} />
        <MapViewportApplier viewport={viewport} />
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
            // Keyed on the scheme rather than relying on react-leaflet to
            // diff-update both `url` and `attribution` in place: a remount
            // on theme change is cheap and guarantees neither prop is left
            // stale.
            key={colorScheme}
            attribution={TILE_ATTRIBUTION}
            url={TILE_URL[colorScheme]}
          />
        )}
        {territories.map((territory) => (
          <GeoJSON
            key={`${territory.id}:${editing}`}
            data={territory.geometry as unknown as GeoJsonObject}
            style={{ color: resolveFeatureColor(territory.entity) }}
            eventHandlers={{
              // While a mode is armed, a click that lands on an existing
              // territory is the user placing a point on top of it — not a
              // request to edit that territory. Outside edit mode the click
              // opens the popup below instead of the edit form.
              click: () => {
                if (!drawing && editing) {
                  onTerritoryClick?.(territory);
                }
              },
            }}
          >
            {!editing ? (
              <Popup>
                <FeatureDetails
                  name={territory.name}
                  subtitle={territory.type}
                  description={territory.description}
                  entity={territory.entity}
                  onOpenEntity={onOpenEntity}
                />
              </Popup>
            ) : null}
            {showTerritoryNames ? (
              <TerritoryLabel territory={territory} view={view} />
            ) : null}
          </GeoJSON>
        ))}
        {(showMarkers ? markers : []).map((marker) => (
          <Marker
            key={marker.id}
            position={[marker.lat, marker.lng]}
            icon={pinIcon(resolveFeatureColor(marker.entity))}
          >
            {/* Fixed-size, unlike territory labels: a marker is a point, so
                there is no shape to scale its name against. */}
            {showMarkerNames ? (
              <Tooltip
                permanent
                direction="top"
                className={styles.markerLabel}
                interactive={false}
              >
                <span data-testid="marker-label">{marker.name}</span>
              </Tooltip>
            ) : null}
            <Popup>
              <div className={styles.popup}>
                <FeatureDetails
                  name={marker.name}
                  description={marker.description}
                  entity={marker.entity}
                  onOpenEntity={onOpenEntity}
                />
                {/* Destructive and mutating actions exist only while
                    editing; reading the map never offers them. */}
                {editing ? (
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
                ) : null}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
