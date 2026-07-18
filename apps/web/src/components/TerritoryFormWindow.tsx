import type { FormEvent } from "react";
import { useState } from "react";
import { useMutation } from "urql";
import {
  Button,
  Form,
  FormError,
  FormField,
  Input,
  Textarea,
} from "@storyforge/ui";

import {
  CreateTerritoryDocument,
  DeleteTerritoryDocument,
  UpdateTerritoryDocument,
} from "../gql/graphql";
import type { AddEditMode } from "../hooks/useAddEditWindow";
import { formatGraphQLError } from "../lib/graphqlError";
import { useWindowChromeSync } from "../lib/WindowChromeContext";
import { EntitySelectField } from "./EntitySelectField";
import styles from "./TerritoryFormWindow.module.css";

export interface TerritoryRow {
  id: string;
  entityId?: string | null;
  entity?: { id: string; name: string; type: string } | null;
  name: string;
  type: string;
  geometry: string;
  description?: string | null;
}

export interface TerritoryFormWindowProps {
  campaignId: string;
  mode: AddEditMode<TerritoryRow>;
  onSaved: () => void;
  onClose: () => void;
}

const DEFAULT_GEOMETRY = JSON.stringify(
  {
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
  null,
  2,
);

// The Add/Edit form content for a single map territory — opened via
// useAddEditWindow, same pattern as SessionFormWindow/EventFormWindow.
// The geometry textarea is normally filled in by drawing the shape on the
// map (KAN-115); it stays editable as the escape hatch for pasting or
// tweaking a ring by hand.
export function TerritoryFormWindow({
  campaignId,
  mode,
  onSaved,
  onClose,
}: TerritoryFormWindowProps) {
  const [createState, createTerritory] = useMutation(CreateTerritoryDocument);
  const [updateState, updateTerritory] = useMutation(UpdateTerritoryDocument);
  const [deleteState, deleteTerritory] = useMutation(DeleteTerritoryDocument);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Forms have nothing to "refresh" — only the blocking loading state
  // applies while a save is in flight.
  useWindowChromeSync(
    createState.fetching || updateState.fetching || deleteState.fetching,
  );

  // In create mode these are seed values from whatever opened the form — a
  // polygon drawn on the map supplies the geometry — rather than a saved row,
  // so every field is optional.
  const initialTerritory: Partial<TerritoryRow> | null =
    mode.mode === "edit" ? mode.item : (mode.initial ?? null);

  async function handleDelete() {
    if (mode.mode !== "edit") {
      return;
    }
    const result = await deleteTerritory({ id: mode.item.id });
    if (result.data?.deleteTerritory) {
      onSaved();
      onClose();
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setValidationError(null);

    const form = event.currentTarget;
    const data = new FormData(form);
    const name = String(data.get("name") ?? "").trim();
    const type = String(data.get("type") ?? "").trim();
    const geometry = String(data.get("geometry") ?? "").trim();
    const description = String(data.get("description") ?? "").trim();
    // The picker's "None" option submits an empty string; the API wants an
    // explicit null to mean unlinked.
    const entityId = String(data.get("entityId") ?? "") || null;

    // `required` alone doesn't stop a whitespace-only value (the browser
    // only checks the raw value is non-empty) — check each trimmed field
    // explicitly and surface it, instead of silently doing nothing.
    if (!name) {
      setValidationError("Name is required.");
      return;
    }

    if (!type) {
      setValidationError("Type is required.");
      return;
    }

    if (!geometry) {
      setValidationError("Geometry is required.");
      return;
    }

    try {
      JSON.parse(geometry);
    } catch {
      setValidationError("Geometry must be valid JSON.");
      return;
    }

    if (mode.mode === "create") {
      const result = await createTerritory({
        input: {
          campaignId,
          name,
          type,
          geometry,
          description: description || null,
          entityId,
        },
      });
      if (result.data?.createTerritory) {
        onSaved();
        onClose();
      }
    } else {
      const result = await updateTerritory({
        input: {
          id: mode.item.id,
          name,
          type,
          geometry,
          description: description || null,
          entityId,
        },
      });
      if (result.data?.updateTerritory) {
        onSaved();
        onClose();
      }
    }
  }

  const formError =
    validationError ??
    formatGraphQLError(
      mode.mode === "create"
        ? createState.error
        : (updateState.error ?? deleteState.error),
    );

  return (
    <Form onSubmit={handleSubmit}>
      <FormError>{formError}</FormError>
      <FormField label="Name" htmlFor="territory-name">
        <Input
          id="territory-name"
          name="name"
          defaultValue={initialTerritory?.name ?? ""}
          required
        />
      </FormField>
      <FormField label="Type" htmlFor="territory-type">
        <Input
          id="territory-type"
          name="type"
          placeholder="e.g. region, district, territory"
          defaultValue={initialTerritory?.type ?? ""}
          required
        />
      </FormField>
      <EntitySelectField
        campaignId={campaignId}
        id="territory-entity"
        name="entityId"
        defaultValue={initialTerritory?.entityId}
      />
      {/* Collapsed by default: the shape is normally drawn on the map, so the
          raw ring is reference material rather than something to fill in. The
          summary doubles as the field label — a FormField label inside would
          duplicate it. */}
      <details className={styles.geometryDetails}>
        <summary>Geometry (GeoJSON)</summary>
        <Textarea
          id="territory-geometry"
          name="geometry"
          aria-label="Geometry (GeoJSON)"
          className={styles.geometry}
          defaultValue={initialTerritory?.geometry ?? DEFAULT_GEOMETRY}
          rows={8}
          required
        />
      </details>
      <FormField label="Description" htmlFor="territory-description">
        <Textarea
          id="territory-description"
          name="description"
          defaultValue={initialTerritory?.description ?? ""}
          rows={3}
        />
      </FormField>
      <div className={styles.actions}>
        {mode.mode === "edit" ? (
          <Button
            type="button"
            variant="secondary"
            disabled={deleteState.fetching}
            onClick={handleDelete}
          >
            Delete
          </Button>
        ) : null}
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={createState.fetching || updateState.fetching}
        >
          Save
        </Button>
      </div>
    </Form>
  );
}
