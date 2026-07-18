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
  Textarea,
} from "@storyforge/ui";

import {
  AttachSessionAttendeeDocument,
  CampaignDocument,
  CreateSessionDocument,
  DetachSessionAttendeeDocument,
  UpdateSessionDocument,
} from "../gql/graphql";
import type { AddEditMode } from "../hooks/useAddEditWindow";
import { formatGraphQLError } from "../lib/graphqlError";
import { useWindowChromeSync } from "../lib/WindowChromeContext";
import styles from "./SessionFormWindow.module.css";

export interface Attendee {
  userId: string;
  user: { id: string; email: string };
}

export interface SessionRow {
  id: string;
  sessionNumber: number;
  date: string;
  summary?: string | null;
  attendees: Attendee[];
}

export interface SessionFormWindowProps {
  campaignId: string;
  mode: AddEditMode<SessionRow>;
  onSaved: () => void;
  onClose: () => void;
}

function formatDate(isoDate: string): string {
  return isoDate.slice(0, 10);
}

// The Add/Edit form content for a single session window — opened via
// useAddEditWindow instead of nesting a Modal inside SessionsWindow (KAN-109,
// following the pattern proven on Notes in KAN-107).
export function SessionFormWindow({
  campaignId,
  mode,
  onSaved,
  onClose,
}: SessionFormWindowProps) {
  const [{ data: campaignData }] = useQuery({
    query: CampaignDocument,
    variables: { id: campaignId },
  });
  const [createState, createSession] = useMutation(CreateSessionDocument);
  const [updateState, updateSession] = useMutation(UpdateSessionDocument);

  // Forms have nothing to "refresh" — only the blocking loading state
  // applies while a save is in flight.
  useWindowChromeSync(createState.fetching || updateState.fetching);
  const [, attachSessionAttendee] = useMutation(AttachSessionAttendeeDocument);
  const [, detachSessionAttendee] = useMutation(DetachSessionAttendeeDocument);

  const initialSession = mode.mode === "edit" ? mode.item : null;
  const [selectedAttendeeIds, setSelectedAttendeeIds] = useState<string[]>(
    initialSession?.attendees.map((a) => a.userId) ?? [],
  );

  const members = campaignData?.campaign?.members ?? [];

  function toggleAttendee(userId: string) {
    setSelectedAttendeeIds((current) =>
      current.includes(userId)
        ? current.filter((id) => id !== userId)
        : [...current, userId],
    );
  }

  async function syncAttendees(sessionId: string, previousIds: string[]) {
    const added = selectedAttendeeIds.filter((id) => !previousIds.includes(id));
    const removed = previousIds.filter(
      (id) => !selectedAttendeeIds.includes(id),
    );

    await Promise.all([
      ...added.map((userId) => attachSessionAttendee({ sessionId, userId })),
      ...removed.map((userId) => detachSessionAttendee({ sessionId, userId })),
    ]);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;
    const data = new FormData(form);
    const date = String(data.get("date") ?? "").trim();
    const summary = String(data.get("summary") ?? "").trim();

    if (!date) {
      return;
    }

    if (mode.mode === "create") {
      const result = await createSession({
        input: { campaignId, date, summary: summary || null },
      });
      if (result.data?.createSession) {
        await syncAttendees(result.data.createSession.id, []);
        onSaved();
        onClose();
      }
    } else {
      const result = await updateSession({
        input: { id: mode.item.id, date, summary: summary || null },
      });
      if (result.data?.updateSession) {
        await syncAttendees(
          mode.item.id,
          mode.item.attendees.map((a) => a.userId),
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
      <FormField label="Date" htmlFor="session-date">
        <Input
          id="session-date"
          name="date"
          type="date"
          defaultValue={initialSession ? formatDate(initialSession.date) : ""}
          required
        />
      </FormField>
      <FormField label="Recap" htmlFor="session-summary">
        <Textarea
          id="session-summary"
          name="summary"
          defaultValue={initialSession?.summary ?? ""}
          rows={4}
        />
      </FormField>
      <FormField label="Attendees" htmlFor="session-attendees">
        <div className={styles.attendeeChecks} id="session-attendees">
          {members.map((member) => (
            <Checkbox
              key={member.userId}
              label={member.user.email}
              checked={selectedAttendeeIds.includes(member.userId)}
              onChange={() => toggleAttendee(member.userId)}
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
