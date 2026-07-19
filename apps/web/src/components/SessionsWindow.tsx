import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery } from "urql";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button, FormError, Icon } from "@storyforge/ui";

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
                  onClick={() => openEditWindow(session)}
                >
                  <Icon icon={Pencil} size={15} aria-hidden="true" />
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
                    <Icon icon={Trash2} size={15} aria-hidden="true" />
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
        <Button type="button" onClick={openCreateWindow}>
          <Icon icon={Plus} size={15} aria-hidden="true" />
          Log session
        </Button>
      ) : null}
    </div>
  );
}
