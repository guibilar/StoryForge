import { useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery } from "urql";
import { Button, FormError } from "@storyforge/ui";

import {
  CampaignDocument,
  DeleteMapImageDocument,
  DeleteMarkerDocument,
  MapImageDocument,
  MarkersDocument,
  MeDocument,
  TerritoriesDocument,
  UploadMapImageDocument,
} from "../gql/graphql";
import { useAddEditWindow } from "../hooks/useAddEditWindow";
import { resolveUploadUrl } from "../lib/apiOrigin";
import { formatGraphQLError } from "../lib/graphqlError";
import { useWindowChromeSync } from "../lib/WindowChromeContext";
import { MapCanvas } from "./MapCanvas";
import type {
  MapDrawMode,
  MapMarkerPoint,
  MapPosition,
  MapTerritoryShape,
} from "./MapCanvas";
import { MarkerFormWindow } from "./MarkerFormWindow";
import type { MarkerRow } from "./MarkerFormWindow";
import { TerritoryFormWindow } from "./TerritoryFormWindow";
import type { TerritoryRow } from "./TerritoryFormWindow";
import styles from "./MapsWindow.module.css";

// Mirrors LocalImageStore's MAX_BYTES (apps/api/src/modules/entities/infrastructure/LocalImageStore.ts)
// — checking client-side first avoids uploading a large file in full only
// to have the server reject it afterwards.
const MAX_MAP_IMAGE_BYTES = 5 * 1024 * 1024;

const COORDINATE_DECIMALS = 6;

function roundCoordinate(value: number): number {
  return Number(value.toFixed(COORDINATE_DECIMALS));
}

// Fetches and renders a campaign's markers/territories on top of KAN-50's
// MapCanvas, plus (for campaign writers) the create/edit forms for each —
// the data-fetching layer KAN-51 adds on top of the presentational canvas.
export function MapsWindow() {
  const { id: campaignId } = useParams<{ id: string }>();

  const [{ data: meData }] = useQuery({ query: MeDocument });
  const [{ data: campaignData }] = useQuery({
    query: CampaignDocument,
    variables: { id: campaignId ?? "" },
    pause: !campaignId,
  });
  const [
    { data: markersData, fetching: markersFetching, error: markersError },
    reexecuteMarkers,
  ] = useQuery({
    query: MarkersDocument,
    variables: { campaignId: campaignId ?? "" },
    pause: !campaignId,
  });
  const [
    {
      data: territoriesData,
      fetching: territoriesFetching,
      error: territoriesError,
    },
    reexecuteTerritories,
  ] = useQuery({
    query: TerritoriesDocument,
    variables: { campaignId: campaignId ?? "" },
    pause: !campaignId,
  });
  const [{ data: mapImageData }, reexecuteMapImage] = useQuery({
    query: MapImageDocument,
    variables: { campaignId: campaignId ?? "" },
    pause: !campaignId,
  });

  const [deleteMarkerState, deleteMarker] = useMutation(DeleteMarkerDocument);
  const [uploadMapImageState, uploadMapImage] = useMutation(
    UploadMapImageDocument,
  );
  const [deleteMapImageState, deleteMapImage] = useMutation(
    DeleteMapImageDocument,
  );
  const [uploadValidationError, setUploadValidationError] = useState<
    string | null
  >(null);
  const [drawMode, setDrawMode] = useState<MapDrawMode>("none");
  // Coordinates alone don't make a placement unique — clicking the same spot
  // twice rounds to the same pair — so a counter guarantees each open create
  // form gets its own window instead of replacing the previous one.
  const placementCountRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { openAddEditWindow: openMarkerWindow } = useAddEditWindow({
    idPrefix: "marker-form",
    width: 380,
    height: 460,
  });
  const { openAddEditWindow: openTerritoryWindow } = useAddEditWindow({
    idPrefix: "territory-form",
    width: 420,
    height: 560,
  });

  const currentUserId = meData?.me?.id;
  const members = campaignData?.campaign?.members ?? [];
  const myRole = members.find(
    (member) => member.userId === currentUserId,
  )?.role;
  const isWriter =
    myRole === "OWNER" ||
    myRole === "STORYTELLER" ||
    myRole === "CO_STORYTELLER";

  const markers: MarkerRow[] = useMemo(
    () => markersData?.markers ?? [],
    [markersData],
  );
  const territories: TerritoryRow[] = useMemo(
    () => territoriesData?.territories ?? [],
    [territoriesData],
  );
  const mapTerritories: MapTerritoryShape[] = useMemo(() => {
    const shapes: MapTerritoryShape[] = [];
    for (const territory of territories) {
      let geometry: Record<string, unknown>;
      try {
        geometry = JSON.parse(territory.geometry) as Record<string, unknown>;
      } catch {
        // Geometry is validated as JSON server-side at write time, so this
        // shouldn't happen — but rendering must not crash the whole window
        // (there's no error boundary in apps/web) over one bad row.
        console.error(
          `Territory ${territory.id} has geometry that isn't valid JSON; skipping it on the map.`,
        );
        continue;
      }
      shapes.push({
        id: territory.id,
        name: territory.name,
        type: territory.type,
        description: territory.description,
        geometry,
      });
    }
    return shapes;
  }, [territories]);
  const mapImage = mapImageData?.mapImage ?? null;
  const imageOverlay = mapImage
    ? { ...mapImage, url: resolveUploadUrl(mapImage.url) }
    : null;

  function refetch() {
    reexecuteMarkers({ requestPolicy: "network-only" });
    reexecuteTerritories({ requestPolicy: "network-only" });
  }

  function openFilePicker() {
    fileInputRef.current?.click();
  }

  async function handleFileSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !campaignId) {
      return;
    }
    setUploadValidationError(null);
    if (file.size > MAX_MAP_IMAGE_BYTES) {
      setUploadValidationError("File size exceeds the maximum limit of 5MB.");
      return;
    }
    const result = await uploadMapImage({ campaignId, file });
    if (result.data?.uploadMapImage) {
      reexecuteMapImage({ requestPolicy: "network-only" });
    }
  }

  async function handleRemoveMapImage() {
    if (!campaignId) {
      return;
    }
    const result = await deleteMapImage({ campaignId });
    if (result.data?.deleteMapImage) {
      reexecuteMapImage({ requestPolicy: "network-only" });
    }
  }

  function openCreateMarkerWindow(position?: MapPosition) {
    if (!campaignId) {
      return;
    }
    // Leaflet reports full float precision; six decimals is ~0.1m of
    // geographic accuracy and still sub-pixel on a custom map image, so it
    // reads as a coordinate rather than a wall of digits in the form.
    const initial = position
      ? {
          lat: roundCoordinate(position.lat),
          lng: roundCoordinate(position.lng),
        }
      : undefined;
    // Two placements in a row must not land on the same window id, or the
    // second silently replaces the first along with anything typed into it.
    // The coordinates are in the id for readability; the counter is what
    // actually makes it unique when the same spot is clicked twice.
    const key = initial
      ? `${++placementCountRef.current}@${initial.lat},${initial.lng}`
      : undefined;

    openMarkerWindow<MarkerRow>(
      { mode: "create", initial, key },
      "New Marker",
      (close) => (
        <MarkerFormWindow
          campaignId={campaignId}
          mode={{ mode: "create", initial }}
          onSaved={refetch}
          onClose={close}
        />
      ),
    );
  }

  // Placing a point is a one-shot gesture: disarm first so a stray second
  // click doesn't open a second form behind the one just opened.
  function handlePlaceMarker(position: MapPosition) {
    setDrawMode("none");
    openCreateMarkerWindow(position);
  }

  function openEditMarkerWindow(marker: MapMarkerPoint) {
    if (!campaignId) {
      return;
    }
    const row = markers.find((m) => m.id === marker.id);
    if (!row) {
      return;
    }
    openMarkerWindow<MarkerRow>(
      { mode: "edit", item: row },
      `Edit: ${row.name}`,
      (close) => (
        <MarkerFormWindow
          campaignId={campaignId}
          mode={{ mode: "edit", item: row }}
          onSaved={refetch}
          onClose={close}
        />
      ),
    );
  }

  async function handleDeleteMarker(marker: MapMarkerPoint) {
    const result = await deleteMarker({ id: marker.id });
    if (result.data?.deleteMarker) {
      refetch();
    }
  }

  function openCreateTerritoryWindow() {
    if (!campaignId) {
      return;
    }
    openTerritoryWindow<TerritoryRow>(
      { mode: "create" },
      "New Territory",
      (close) => (
        <TerritoryFormWindow
          campaignId={campaignId}
          mode={{ mode: "create" }}
          onSaved={refetch}
          onClose={close}
        />
      ),
    );
  }

  function openEditTerritoryWindow(territory: MapTerritoryShape) {
    if (!campaignId) {
      return;
    }
    const row = territories.find((t) => t.id === territory.id);
    if (!row) {
      return;
    }
    openTerritoryWindow<TerritoryRow>(
      { mode: "edit", item: row },
      `Edit: ${row.name}`,
      (close) => (
        <TerritoryFormWindow
          campaignId={campaignId}
          mode={{ mode: "edit", item: row }}
          onSaved={refetch}
          onClose={close}
        />
      ),
    );
  }

  const fetching = markersFetching || territoriesFetching;
  useWindowChromeSync(fetching, refetch);

  if (fetching) {
    return <p>Loading map…</p>;
  }

  const error = markersError ?? territoriesError;
  if (error) {
    return <p>{formatGraphQLError(error) ?? "Unable to load the map."}</p>;
  }

  const actionError =
    uploadValidationError ??
    formatGraphQLError(uploadMapImageState.error) ??
    formatGraphQLError(deleteMarkerState.error) ??
    formatGraphQLError(deleteMapImageState.error);

  return (
    <div className={styles.wrap}>
      <div className={styles.canvas}>
        <MapCanvas
          markers={markers}
          territories={mapTerritories}
          imageOverlay={imageOverlay}
          markerActionPending={deleteMarkerState.fetching}
          drawMode={drawMode}
          onDrawModeChange={isWriter ? setDrawMode : undefined}
          onPlaceMarker={isWriter ? handlePlaceMarker : undefined}
          onEditMarker={openEditMarkerWindow}
          onDeleteMarker={handleDeleteMarker}
          onTerritoryClick={isWriter ? openEditTerritoryWindow : undefined}
        />
      </div>
      {isWriter ? (
        <div className={styles.actions}>
          {/* Wrapped rather than passed directly: onClick would otherwise
              hand the MouseEvent to the position parameter. */}
          <Button type="button" onClick={() => openCreateMarkerWindow()}>
            + Add Marker
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={openCreateTerritoryWindow}
          >
            + Add Territory
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            className={styles.hiddenFileInput}
            onChange={handleFileSelected}
          />
          <Button
            type="button"
            variant="secondary"
            disabled={uploadMapImageState.fetching}
            onClick={openFilePicker}
          >
            {mapImage ? "Replace Map Image" : "Upload Map Image"}
          </Button>
          {mapImage ? (
            <Button
              type="button"
              variant="secondary"
              disabled={deleteMapImageState.fetching}
              onClick={handleRemoveMapImage}
            >
              Remove Map Image
            </Button>
          ) : null}
          {actionError ? <FormError>{actionError}</FormError> : null}
        </div>
      ) : null}
    </div>
  );
}
