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

import { CreateMarkerDocument, UpdateMarkerDocument } from "../gql/graphql";
import type { AddEditMode } from "../hooks/useAddEditWindow";
import { formatGraphQLError } from "../lib/graphqlError";
import { useWindowChromeSync } from "../lib/WindowChromeContext";
import styles from "./MarkerFormWindow.module.css";

export interface MarkerRow {
  id: string;
  name: string;
  lat: number;
  lng: number;
  description?: string | null;
}

export interface MarkerFormWindowProps {
  campaignId: string;
  mode: AddEditMode<MarkerRow>;
  onSaved: () => void;
  onClose: () => void;
}

// The Add/Edit form content for a single map marker — opened via
// useAddEditWindow, same pattern as SessionFormWindow/EventFormWindow.
export function MarkerFormWindow({
  campaignId,
  mode,
  onSaved,
  onClose,
}: MarkerFormWindowProps) {
  const [createState, createMarker] = useMutation(CreateMarkerDocument);
  const [updateState, updateMarker] = useMutation(UpdateMarkerDocument);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Forms have nothing to "refresh" — only the blocking loading state
  // applies while a save is in flight.
  useWindowChromeSync(createState.fetching || updateState.fetching);

  const initialMarker = mode.mode === "edit" ? mode.item : null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setValidationError(null);

    const form = event.currentTarget;
    const data = new FormData(form);
    const name = String(data.get("name") ?? "").trim();
    const lat = Number(data.get("lat"));
    const lng = Number(data.get("lng"));
    const description = String(data.get("description") ?? "").trim();

    // `required` alone doesn't stop a whitespace-only value (the browser
    // only checks the raw value is non-empty) — check the trimmed name
    // explicitly and surface it, instead of silently doing nothing.
    if (!name) {
      setValidationError("Name is required.");
      return;
    }

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      setValidationError("Latitude and longitude must be valid numbers.");
      return;
    }

    if (mode.mode === "create") {
      const result = await createMarker({
        input: { campaignId, name, lat, lng, description: description || null },
      });
      if (result.data?.createMarker) {
        onSaved();
        onClose();
      }
    } else {
      const result = await updateMarker({
        input: {
          id: mode.item.id,
          name,
          lat,
          lng,
          description: description || null,
        },
      });
      if (result.data?.updateMarker) {
        onSaved();
        onClose();
      }
    }
  }

  const formError =
    validationError ??
    formatGraphQLError(
      mode.mode === "create" ? createState.error : updateState.error,
    );

  return (
    <Form onSubmit={handleSubmit}>
      <FormError>{formError}</FormError>
      <FormField label="Name" htmlFor="marker-name">
        <Input
          id="marker-name"
          name="name"
          defaultValue={initialMarker?.name ?? ""}
          required
        />
      </FormField>
      <div className={styles.coords}>
        <FormField label="Latitude" htmlFor="marker-lat">
          <Input
            id="marker-lat"
            name="lat"
            type="number"
            step="any"
            defaultValue={initialMarker?.lat ?? 0}
            required
          />
        </FormField>
        <FormField label="Longitude" htmlFor="marker-lng">
          <Input
            id="marker-lng"
            name="lng"
            type="number"
            step="any"
            defaultValue={initialMarker?.lng ?? 0}
            required
          />
        </FormField>
      </div>
      <FormField label="Description" htmlFor="marker-description">
        <Textarea
          id="marker-description"
          name="description"
          defaultValue={initialMarker?.description ?? ""}
          rows={3}
        />
      </FormField>
      <div className={styles.actions}>
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
