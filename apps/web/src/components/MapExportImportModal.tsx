import type { ChangeEvent } from "react";
import { useRef, useState } from "react";
import { useMutation } from "urql";
import { Download, Upload } from "lucide-react";
import { Button, FormActions, FormError, Icon, Modal } from "@storyforge/ui";

import { CreateMarkerDocument, CreateTerritoryDocument } from "../gql/graphql";
import type { MarkerRow } from "./MarkerFormWindow";
import type { TerritoryRow } from "./TerritoryFormWindow";
import styles from "./MapExportImportModal.module.css";

const EXPORT_FORMAT = "storyforge.geo-map-export";
const EXPORT_VERSION = 1;

interface ExportedMarker {
  name: string;
  lat: number;
  lng: number;
  description: string | null;
}

interface ExportedTerritory {
  name: string;
  type: string;
  geometry: Record<string, unknown>;
  description: string | null;
}

export interface MapExportImportModalProps {
  campaignId: string;
  campaignName: string;
  markers: MarkerRow[];
  territories: TerritoryRow[];
  onClose: () => void;
  onImported: () => void;
}

interface ImportSummary {
  markers: number;
  territories: number;
  failed: number;
}

function slugifyFileName(name: string): string {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "map";
}

// Skips a territory whose geometry isn't valid JSON rather than failing the
// whole export — mirrors MapsWindow's own tolerance for a bad row when
// rendering territories on the canvas.
function parseTerritoryGeometry(
  territory: TerritoryRow,
): Record<string, unknown> | null {
  try {
    return JSON.parse(territory.geometry) as Record<string, unknown>;
  } catch {
    console.error(
      `Territory ${territory.id} has geometry that isn't valid JSON; skipping it in the export.`,
    );
    return null;
  }
}

// Reads back whatever an export produced. Individual malformed entries are
// dropped rather than rejecting the whole file — a hand-edited or partially
// corrupted file should still import what it can.
function parseImportFile(raw: string): {
  markers: ExportedMarker[];
  territories: ExportedTerritory[];
} {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("That file isn't valid JSON.");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("That file doesn't look like a map export.");
  }

  const root = parsed as Record<string, unknown>;
  const rawMarkers = Array.isArray(root.markers) ? root.markers : [];
  const rawTerritories = Array.isArray(root.territories)
    ? root.territories
    : [];

  const markers: ExportedMarker[] = [];
  for (const item of rawMarkers) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const candidate = item as Record<string, unknown>;
    const name =
      typeof candidate.name === "string" ? candidate.name.trim() : "";
    const lat = Number(candidate.lat);
    const lng = Number(candidate.lng);
    if (!name || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      continue;
    }
    markers.push({
      name,
      lat,
      lng,
      description:
        typeof candidate.description === "string"
          ? candidate.description
          : null,
    });
  }

  const territories: ExportedTerritory[] = [];
  for (const item of rawTerritories) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const candidate = item as Record<string, unknown>;
    const name =
      typeof candidate.name === "string" ? candidate.name.trim() : "";
    const type =
      typeof candidate.type === "string" ? candidate.type.trim() : "";
    const geometry =
      candidate.geometry && typeof candidate.geometry === "object"
        ? (candidate.geometry as Record<string, unknown>)
        : null;
    if (!name || !type || !geometry) {
      continue;
    }
    territories.push({
      name,
      type,
      geometry,
      description:
        typeof candidate.description === "string"
          ? candidate.description
          : null,
    });
  }

  if (markers.length === 0 && territories.length === 0) {
    throw new Error(
      "That file doesn't contain any readable markers or territories.",
    );
  }

  return { markers, territories };
}

// Lets a Storyteller back up or move a campaign's geographic map data — the
// markers and territories plotted on the geographic tile layer — as a JSON
// file (KAN map export/import). Kept out of the main actions bar as a single
// trigger button that opens this modal, rather than adding several controls
// there directly.
export function MapExportImportModal({
  campaignId,
  campaignName,
  markers,
  territories,
  onClose,
  onImported,
}: MapExportImportModalProps) {
  const [, createMarker] = useMutation(CreateMarkerDocument);
  const [, createTerritory] = useMutation(CreateTerritoryDocument);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(
    null,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasData = markers.length > 0 || territories.length > 0;

  function handleExport() {
    const exportedTerritories: ExportedTerritory[] = [];
    for (const territory of territories) {
      const geometry = parseTerritoryGeometry(territory);
      if (!geometry) {
        continue;
      }
      exportedTerritories.push({
        name: territory.name,
        type: territory.type,
        geometry,
        description: territory.description ?? null,
      });
    }

    const payload = {
      format: EXPORT_FORMAT,
      version: EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      campaignName,
      markers: markers.map((marker): ExportedMarker => ({
        name: marker.name,
        lat: marker.lat,
        lng: marker.lng,
        description: marker.description ?? null,
      })),
      territories: exportedTerritories,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${slugifyFileName(campaignName)}-map.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function openFilePicker() {
    fileInputRef.current?.click();
  }

  async function handleFileSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }

    setImportError(null);
    setImportSummary(null);
    setImporting(true);

    try {
      const text = await file.text();
      const { markers: importMarkers, territories: importTerritories } =
        parseImportFile(text);

      let markersCreated = 0;
      let territoriesCreated = 0;
      let failed = 0;

      // Sequential, not Promise.all: keeps a huge import from firing
      // hundreds of mutations at once against the API.
      for (const marker of importMarkers) {
        const result = await createMarker({
          input: {
            campaignId,
            name: marker.name,
            lat: marker.lat,
            lng: marker.lng,
            description: marker.description,
          },
        });
        if (result.data?.createMarker) {
          markersCreated += 1;
        } else {
          failed += 1;
        }
      }

      for (const territory of importTerritories) {
        const result = await createTerritory({
          input: {
            campaignId,
            name: territory.name,
            type: territory.type,
            geometry: JSON.stringify(territory.geometry),
            description: territory.description,
          },
        });
        if (result.data?.createTerritory) {
          territoriesCreated += 1;
        } else {
          failed += 1;
        }
      }

      setImportSummary({
        markers: markersCreated,
        territories: territoriesCreated,
        failed,
      });
      if (markersCreated > 0 || territoriesCreated > 0) {
        onImported();
      }
    } catch (error) {
      setImportError(
        error instanceof Error ? error.message : "Unable to import that file.",
      );
    } finally {
      setImporting(false);
    }
  }

  return (
    <Modal open onClose={onClose}>
      <h2>Export / import map data</h2>
      <p className={styles.description}>
        Save this map&apos;s markers and territories to a JSON file, or add
        markers and territories from a previously exported file. This covers the
        geographic tile layer only — a campaign map with a custom uploaded image
        uses pixel coordinates specific to that image, so it isn&apos;t
        included.
      </p>

      <section className={styles.section}>
        <h3>Export</h3>
        <p className={styles.hint}>
          {markers.length} marker{markers.length === 1 ? "" : "s"},{" "}
          {territories.length} territor
          {territories.length === 1 ? "y" : "ies"}
        </p>
        <Button
          type="button"
          variant="secondary"
          disabled={!hasData}
          onClick={handleExport}
        >
          <Icon icon={Download} size={15} aria-hidden="true" />
          Download as JSON
        </Button>
      </section>

      <section className={styles.section}>
        <h3>Import</h3>
        <p className={styles.hint}>
          Adds markers and territories from a file to this map. Existing items
          aren&apos;t changed or removed.
        </p>
        {importError ? <FormError>{importError}</FormError> : null}
        {importSummary ? (
          <p className={styles.summary}>
            Imported {importSummary.markers} marker
            {importSummary.markers === 1 ? "" : "s"} and{" "}
            {importSummary.territories} territor
            {importSummary.territories === 1 ? "y" : "ies"}.
            {importSummary.failed > 0
              ? ` ${importSummary.failed} item${
                  importSummary.failed === 1 ? "" : "s"
                } failed to import.`
              : ""}
          </p>
        ) : null}
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          className={styles.hiddenFileInput}
          onChange={handleFileSelected}
        />
        <Button
          type="button"
          variant="secondary"
          disabled={importing}
          onClick={openFilePicker}
        >
          <Icon icon={Upload} size={15} aria-hidden="true" />
          {importing ? "Importing…" : "Choose file to import"}
        </Button>
      </section>

      <FormActions>
        <Button
          type="button"
          variant="secondary"
          disabled={importing}
          onClick={onClose}
        >
          Close
        </Button>
      </FormActions>
    </Modal>
  );
}
