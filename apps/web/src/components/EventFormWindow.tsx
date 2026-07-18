import type { FormEvent } from "react";
import { useState } from "react";
import { useMutation, useQuery } from "urql";
import {
  Button,
  Checkbox,
  Form,
  FormError,
  FormField,
  Input,
  Select,
  Textarea,
} from "@storyforge/ui";

import {
  AttachParticipantDocument,
  CreateEventDocument,
  DetachParticipantDocument,
  EntitiesDocument,
  SessionsDocument,
  UpdateEventDocument,
} from "../gql/graphql";
import type { AddEditMode } from "../hooks/useAddEditWindow";
import { formatGraphQLError } from "../lib/graphqlError";
import styles from "./EventFormWindow.module.css";

export interface Participant {
  id: string;
  name: string;
}

export interface EventRow {
  id: string;
  title: string;
  description?: string | null;
  occurredAt: string;
  sessionId?: string | null;
  session?: { id: string; sessionNumber: number } | null;
  participants: Participant[];
}

export interface EventFormWindowProps {
  campaignId: string;
  mode: AddEditMode<EventRow>;
  onSaved: () => void;
  onClose: () => void;
}

// The Add/Edit form content for a single timeline event window — opened via
// useAddEditWindow instead of nesting a Modal inside TimelineWindow (KAN-109,
// following the pattern proven on Notes in KAN-107).
export function EventFormWindow({
  campaignId,
  mode,
  onSaved,
  onClose,
}: EventFormWindowProps) {
  const [{ data: entitiesData }] = useQuery({
    query: EntitiesDocument,
    variables: { campaignId },
  });
  const [{ data: sessionsData }] = useQuery({
    query: SessionsDocument,
    variables: { campaignId },
  });
  const [createState, createEvent] = useMutation(CreateEventDocument);
  const [updateState, updateEvent] = useMutation(UpdateEventDocument);
  const [, attachParticipant] = useMutation(AttachParticipantDocument);
  const [, detachParticipant] = useMutation(DetachParticipantDocument);

  const initialEvent = mode.mode === "edit" ? mode.item : null;
  const [selectedParticipantIds, setSelectedParticipantIds] = useState<
    string[]
  >(initialEvent?.participants.map((p) => p.id) ?? []);

  const entities = entitiesData?.entities ?? [];
  const sessions = sessionsData?.sessions ?? [];

  function toggleParticipant(entityId: string) {
    setSelectedParticipantIds((current) =>
      current.includes(entityId)
        ? current.filter((id) => id !== entityId)
        : [...current, entityId],
    );
  }

  async function syncParticipants(eventId: string, previousIds: string[]) {
    const added = selectedParticipantIds.filter(
      (id) => !previousIds.includes(id),
    );
    const removed = previousIds.filter(
      (id) => !selectedParticipantIds.includes(id),
    );

    await Promise.all([
      ...added.map((entityId) => attachParticipant({ eventId, entityId })),
      ...removed.map((entityId) => detachParticipant({ eventId, entityId })),
    ]);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;
    const data = new FormData(form);
    const title = String(data.get("title") ?? "").trim();
    const description = String(data.get("description") ?? "").trim();
    const occurredAt = String(data.get("occurredAt") ?? "").trim();
    const sessionId = String(data.get("sessionId") ?? "") || null;

    if (!title || !occurredAt) {
      return;
    }

    if (mode.mode === "create") {
      const result = await createEvent({
        input: {
          campaignId,
          title,
          description: description || null,
          occurredAt,
          sessionId,
        },
      });
      if (result.data?.createEvent) {
        await syncParticipants(result.data.createEvent.id, []);
        onSaved();
        onClose();
      }
    } else {
      const result = await updateEvent({
        input: {
          id: mode.item.id,
          title,
          description: description || null,
          occurredAt,
          sessionId,
        },
      });
      if (result.data?.updateEvent) {
        await syncParticipants(
          mode.item.id,
          mode.item.participants.map((p) => p.id),
        );
        onSaved();
        onClose();
      }
    }
  }

  const formError = formatGraphQLError(
    mode.mode === "create" ? createState.error : updateState.error,
  );

  return (
    <Form onSubmit={handleSubmit}>
      <FormError>{formError}</FormError>
      <FormField label="Title" htmlFor="event-title">
        <Input
          id="event-title"
          name="title"
          defaultValue={initialEvent?.title ?? ""}
          required
        />
      </FormField>
      <FormField label="Description" htmlFor="event-description">
        <Textarea
          id="event-description"
          name="description"
          defaultValue={initialEvent?.description ?? ""}
          rows={3}
        />
      </FormField>
      <FormField label="Order (in-fiction)" htmlFor="event-occurredAt">
        <Input
          id="event-occurredAt"
          name="occurredAt"
          placeholder="e.g. Day 14, after the masquerade"
          defaultValue={initialEvent?.occurredAt ?? ""}
          required
        />
      </FormField>
      <FormField label="Logged in session" htmlFor="event-sessionId">
        <Select
          id="event-sessionId"
          name="sessionId"
          defaultValue={initialEvent?.sessionId ?? ""}
          className={styles.sessionSelect}
        >
          <option value="">— none —</option>
          {sessions.map((session) => (
            <option key={session.id} value={session.id}>
              #{session.sessionNumber} — {session.date}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField label="Participants" htmlFor="event-participants">
        <div className={styles.participantChecks} id="event-participants">
          {entities.map((entity) => (
            <Checkbox
              key={entity.id}
              label={entity.name}
              checked={selectedParticipantIds.includes(entity.id)}
              onChange={() => toggleParticipant(entity.id)}
            />
          ))}
        </div>
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
