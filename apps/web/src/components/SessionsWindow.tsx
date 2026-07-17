import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery } from "urql";
import { Button, Form, FormError, FormField, Modal } from "@storyforge/ui";

import {
  AttachSessionAttendeeDocument,
  CampaignDocument,
  CreateSessionDocument,
  DeleteSessionDocument,
  DetachSessionAttendeeDocument,
  MeDocument,
  SessionsDocument,
  UpdateSessionDocument,
} from "../gql/graphql";
import { formatGraphQLError } from "../lib/graphqlError";
import styles from "./SessionsWindow.module.css";

interface Attendee {
  userId: string;
  user: { id: string; email: string };
}

interface SessionRow {
  id: string;
  sessionNumber: number;
  date: string;
  summary?: string | null;
  attendees: Attendee[];
}

type ModalState =
  { mode: "create" } | { mode: "edit"; session: SessionRow } | null;

function formatDate(isoDate: string): string {
  return isoDate.slice(0, 10);
}

export function SessionsWindow() {
  const { id: campaignId } = useParams<{ id: string }>();

  const [{ data: meData }] = useQuery({ query: MeDocument });
  const [{ data: campaignData }] = useQuery({
    query: CampaignDocument,
    variables: { id: campaignId ?? "" },
    pause: !campaignId,
  });
  const [{ data: sessionsData, fetching, error }, reexecuteSessions] = useQuery(
    {
      query: SessionsDocument,
      variables: { campaignId: campaignId ?? "" },
      pause: !campaignId,
    },
  );

  const [createState, createSession] = useMutation(CreateSessionDocument);
  const [updateState, updateSession] = useMutation(UpdateSessionDocument);
  const [deleteState, deleteSession] = useMutation(DeleteSessionDocument);
  const [, attachSessionAttendee] = useMutation(AttachSessionAttendeeDocument);
  const [, detachSessionAttendee] = useMutation(DetachSessionAttendeeDocument);

  const [modal, setModal] = useState<ModalState>(null);
  const [dismissedFormError, setDismissedFormError] = useState(false);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(
    null,
  );
  const [selectedAttendeeIds, setSelectedAttendeeIds] = useState<string[]>([]);

  const currentUserId = meData?.me?.id;
  const members = campaignData?.campaign?.members ?? [];
  const myRole = members.find(
    (member) => member.userId === currentUserId,
  )?.role;
  const isWriter =
    myRole === "OWNER" ||
    myRole === "STORYTELLER" ||
    myRole === "CO_STORYTELLER";

  const sessions: SessionRow[] = useMemo(
    () =>
      [...(sessionsData?.sessions ?? [])].sort(
        (a, b) => b.sessionNumber - a.sessionNumber,
      ),
    [sessionsData],
  );

  function refetch() {
    reexecuteSessions({ requestPolicy: "network-only" });
  }

  function openCreateModal() {
    setDismissedFormError(false);
    setSelectedAttendeeIds([]);
    setModal({ mode: "create" });
  }

  function openEditModal(session: SessionRow) {
    setDismissedFormError(false);
    setSelectedAttendeeIds(session.attendees.map((a) => a.userId));
    setModal({ mode: "edit", session });
  }

  function closeModal() {
    setModal(null);
    setDismissedFormError(true);
  }

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
    if (!campaignId || !modal) {
      return;
    }

    const form = event.currentTarget;
    const data = new FormData(form);
    const date = String(data.get("date") ?? "").trim();
    const summary = String(data.get("summary") ?? "").trim();

    if (!date) {
      return;
    }

    if (modal.mode === "create") {
      const result = await createSession({
        input: { campaignId, date, summary: summary || null },
      });
      if (result.data?.createSession) {
        await syncAttendees(result.data.createSession.id, []);
        closeModal();
        refetch();
      }
    } else {
      const result = await updateSession({
        input: { id: modal.session.id, date, summary: summary || null },
      });
      if (result.data?.updateSession) {
        await syncAttendees(
          modal.session.id,
          modal.session.attendees.map((a) => a.userId),
        );
        closeModal();
        refetch();
      }
    }
  }

  async function handleDelete(id: string) {
    const result = await deleteSession({ id });
    if (result.data?.deleteSession) {
      setConfirmingDeleteId(null);
      refetch();
    }
  }

  if (fetching) {
    return <p>Loading sessions…</p>;
  }

  if (error) {
    return <p>{formatGraphQLError(error) ?? "Unable to load sessions."}</p>;
  }

  const deleteError = formatGraphQLError(deleteState.error);
  const formError = dismissedFormError
    ? null
    : formatGraphQLError(
        modal?.mode === "create" ? createState.error : updateState.error,
      );

  return (
    <div className={styles.wrap}>
      <ul className={styles.list}>
        {sessions.map((session) => (
          <li key={session.id} className={styles.row}>
            <span className={styles.badge}>#{session.sessionNumber}</span>
            <div className={styles.body}>
              <div className={styles.meta}>
                <span className={styles.date}>{formatDate(session.date)}</span>
                <span className={styles.attendeeList}>
                  {session.attendees.map((a) => a.user.email).join(", ")}
                </span>
              </div>
              {session.summary ? (
                <p className={styles.recap}>{session.summary}</p>
              ) : null}
            </div>
            {isWriter ? (
              <div className={styles.actions}>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => openEditModal(session)}
                >
                  Edit
                </Button>
                {confirmingDeleteId === session.id ? (
                  <>
                    <FormError>{deleteError}</FormError>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={deleteState.fetching}
                      onClick={() => handleDelete(session.id)}
                    >
                      Confirm
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setConfirmingDeleteId(null)}
                    >
                      Cancel
                    </Button>
                  </>
                ) : (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setConfirmingDeleteId(session.id)}
                  >
                    Delete
                  </Button>
                )}
              </div>
            ) : null}
          </li>
        ))}
        {sessions.length === 0 ? (
          <li className={styles.empty}>No sessions logged yet.</li>
        ) : null}
      </ul>

      {isWriter ? (
        <Button type="button" onClick={openCreateModal}>
          + Log session
        </Button>
      ) : null}

      <Modal open={modal !== null} onClose={closeModal}>
        {modal ? (
          <>
            <h2>{modal.mode === "edit" ? "Edit session" : "Log session"}</h2>
            <Form onSubmit={handleSubmit}>
              <FormError>{formError}</FormError>
              <FormField label="Date" htmlFor="session-date">
                <input
                  id="session-date"
                  name="date"
                  type="date"
                  defaultValue={
                    modal.mode === "edit" ? formatDate(modal.session.date) : ""
                  }
                  className={styles.dateInput}
                  required
                />
              </FormField>
              <FormField label="Recap" htmlFor="session-summary">
                <textarea
                  id="session-summary"
                  name="summary"
                  defaultValue={
                    modal.mode === "edit" ? (modal.session.summary ?? "") : ""
                  }
                  rows={4}
                  className={styles.textarea}
                />
              </FormField>
              <FormField label="Attendees" htmlFor="session-attendees">
                <div className={styles.attendeeChecks} id="session-attendees">
                  {members.map((member) => (
                    <label key={member.userId} className={styles.checkPill}>
                      <input
                        type="checkbox"
                        checked={selectedAttendeeIds.includes(member.userId)}
                        onChange={() => toggleAttendee(member.userId)}
                      />
                      {member.user.email}
                    </label>
                  ))}
                </div>
              </FormField>
              <div className={styles.modalActions}>
                <Button type="button" variant="secondary" onClick={closeModal}>
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
          </>
        ) : null}
      </Modal>
    </div>
  );
}
