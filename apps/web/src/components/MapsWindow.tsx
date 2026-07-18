import { useMemo, useRef } from "react";
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
import type { MapMarkerPoint, MapTerritoryShape } from "./MapCanvas";
import { MarkerFormWindow } from "./MarkerFormWindow";
import type { MarkerRow } from "./MarkerFormWindow";
import { TerritoryFormWindow } from "./TerritoryFormWindow";
import type { TerritoryRow } from "./TerritoryFormWindow";
import styles from "./MapsWindow.module.css";

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

  const [, deleteMarker] = useMutation(DeleteMarkerDocument);
  const [uploadMapImageState, uploadMapImage] = useMutation(
    UploadMapImageDocument,
  );
  const [, deleteMapImage] = useMutation(DeleteMapImageDocument);
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
  const mapTerritories: MapTerritoryShape[] = useMemo(
    () =>
      territories.map((territory) => ({
        id: territory.id,
        name: territory.name,
        type: territory.type,
        description: territory.description,
        geometry: JSON.parse(territory.geometry) as Record<string, unknown>,
      })),
    [territories],
  );
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

  function openCreateMarkerWindow() {
    if (!campaignId) {
      return;
    }
    openMarkerWindow<MarkerRow>({ mode: "create" }, "New Marker", (close) => (
      <MarkerFormWindow
        campaignId={campaignId}
        mode={{ mode: "create" }}
        onSaved={refetch}
        onClose={close}
      />
    ));
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

  const uploadError = formatGraphQLError(uploadMapImageState.error);

  return (
    <div className={styles.wrap}>
      <div className={styles.canvas}>
        <MapCanvas
          markers={markers}
          territories={mapTerritories}
          imageOverlay={imageOverlay}
          onEditMarker={openEditMarkerWindow}
          onDeleteMarker={handleDeleteMarker}
          onTerritoryClick={isWriter ? openEditTerritoryWindow : undefined}
        />
      </div>
      {isWriter ? (
        <div className={styles.actions}>
          <Button type="button" onClick={openCreateMarkerWindow}>
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
              onClick={handleRemoveMapImage}
            >
              Remove Map Image
            </Button>
          ) : null}
          {uploadError ? <FormError>{uploadError}</FormError> : null}
        </div>
      ) : null}
    </div>
  );
}
