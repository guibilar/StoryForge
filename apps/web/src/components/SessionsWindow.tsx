import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery } from "urql";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { Button, FormError, Icon, IconButton } from "@storyforge/ui";

import {
  CampaignDocument,
  DeleteSessionDocument,
  MeDocument,
  SessionsDocument,
} from "../gql/graphql";
import { useAddEditWindow } from "../hooks/useAddEditWindow";
import { formatGraphQLError } from "../lib/graphqlError";
import { useWindowChromeSync } from "../lib/WindowChromeContext";
import { SessionFormWindow } from "./SessionFormWindow";
import type { SessionRow } from "./SessionFormWindow";
import styles from "./SessionsWindow.module.css";

function formatDate(isoDate: string): string {
  return isoDate.slice(0, 10);
}

// Full email addresses joined together overflowed the row and buried the
// recap. Show the local part of the first few, count the rest, and keep the
// full list in a tooltip.
const MAX_VISIBLE_ATTENDEES = 3;

function formatAttendees(emails: string[]): string {
  if (emails.length === 0) {
    return "No attendees";
  }
  const names = emails.map((email) => email.split("@")[0]);
  const shown = names.slice(0, MAX_VISIBLE_ATTENDEES).join(", ");
  const hidden = names.length - MAX_VISIBLE_ATTENDEES;
  return hidden > 0 ? `${shown} +${hidden}` : shown;
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

  const [deleteState, deleteSession] = useMutation(DeleteSessionDocument);
  const { openAddEditWindow } = useAddEditWindow({
    idPrefix: "session-form",
    width: 420,
    height: 480,
  });

  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(
    null,
  );

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

  function openCreateWindow() {
    if (!campaignId) {
      return;
    }
    openAddEditWindow<SessionRow>(
      { mode: "create" },
      "Log Session",
      (close) => (
        <SessionFormWindow
          campaignId={campaignId}
          mode={{ mode: "create" }}
          onSaved={refetch}
          onClose={close}
        />
      ),
    );
  }

  function openEditWindow(session: SessionRow) {
    if (!campaignId) {
      return;
    }
    openAddEditWindow<SessionRow>(
      { mode: "edit", item: session },
      `Edit: Session #${session.sessionNumber}`,
      (close) => (
        <SessionFormWindow
          campaignId={campaignId}
          mode={{ mode: "edit", item: session }}
          onSaved={refetch}
          onClose={close}
        />
      ),
    );
  }

  async function handleDelete(id: string) {
    const result = await deleteSession({ id });
    if (result.data?.deleteSession) {
      setConfirmingDeleteId(null);
      refetch();
    }
  }

  useWindowChromeSync(fetching, refetch);

  if (fetching) {
    return <p>Loading sessions…</p>;
  }

  if (error) {
    return <p>{formatGraphQLError(error) ?? "Unable to load sessions."}</p>;
  }

  const deleteError = formatGraphQLError(deleteState.error);

  return (
    <div className={styles.wrap}>
      {deleteError ? <FormError>{deleteError}</FormError> : null}

      <ul className={styles.list}>
        {sessions.map((session) => {
          const attendeeEmails = session.attendees.map((a) => a.user.email);
          return (
            <li key={session.id} className={styles.row}>
              <span className={styles.badge}>#{session.sessionNumber}</span>
              <div className={styles.body}>
                <div className={styles.meta}>
                  <span className={styles.date}>
                    {formatDate(session.date)}
                  </span>
                  <span
                    className={styles.attendeeList}
                    title={attendeeEmails.join(", ")}
                  >
                    {formatAttendees(attendeeEmails)}
                  </span>
                </div>
                {session.summary ? (
                  <p className={styles.recap}>{session.summary}</p>
                ) : null}
              </div>
              {isWriter ? (
                <div
                  className={
                    confirmingDeleteId === session.id
                      ? `${styles.actions} ${styles.actionsPinned}`
                      : styles.actions
                  }
                >
                  {confirmingDeleteId === session.id ? (
                    <>
                      <IconButton
                        icon={Check}
                        label={`Confirm delete of session #${session.sessionNumber}`}
                        variant="danger"
                        disabled={deleteState.fetching}
                        onClick={() => handleDelete(session.id)}
                      />
                      <IconButton
                        icon={X}
                        label="Cancel delete"
                        variant="ghost"
                        onClick={() => setConfirmingDeleteId(null)}
                      />
                    </>
                  ) : (
                    <>
                      <IconButton
                        icon={Pencil}
                        label={`Edit session #${session.sessionNumber}`}
                        onClick={() => openEditWindow(session)}
                      />
                      <IconButton
                        icon={Trash2}
                        label={`Delete session #${session.sessionNumber}`}
                        onClick={() => setConfirmingDeleteId(session.id)}
                      />
                    </>
                  )}
                </div>
              ) : null}
            </li>
          );
        })}
        {sessions.length === 0 ? (
          <li className={styles.empty}>No sessions logged yet.</li>
        ) : null}
      </ul>

      {isWriter ? (
        <Button type="button" onClick={openCreateWindow}>
          <Icon icon={Plus} size={15} aria-hidden="true" />
          Log session
        </Button>
      ) : null}
    </div>
  );
}
