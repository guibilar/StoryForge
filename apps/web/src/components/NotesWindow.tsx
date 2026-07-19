import { useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery } from "urql";
import { Plus, Trash2 } from "lucide-react";
import { Button, FormError, Icon } from "@storyforge/ui";

import {
  CampaignDocument,
  DeleteNoteDocument,
  MeDocument,
  NotesDocument,
} from "../gql/graphql";
import { useAddEditWindow } from "../hooks/useAddEditWindow";
import { formatGraphQLError } from "../lib/graphqlError";
import { useWindowChromeSync } from "../lib/WindowChromeContext";
import { NoteFormWindow } from "./NoteFormWindow";
import type { NoteRow } from "./NoteFormWindow";
import styles from "./NotesWindow.module.css";

function previewOf(content: string): string {
  const flat = content.replace(/\s+/g, " ").trim();
  return flat.length > 120 ? `${flat.slice(0, 120)}…` : flat;
}

export function NotesWindow() {
  const { id: campaignId } = useParams<{ id: string }>();

  const [{ data: meData }] = useQuery({ query: MeDocument });
  const [{ data: campaignData }] = useQuery({
    query: CampaignDocument,
    variables: { id: campaignId ?? "" },
    pause: !campaignId,
  });
  const [{ data: notesData, fetching, error }, reexecuteNotes] = useQuery({
    query: NotesDocument,
    variables: { campaignId: campaignId ?? "" },
    pause: !campaignId,
  });

  const [deleteState, deleteNote] = useMutation(DeleteNoteDocument);
  const { openAddEditWindow } = useAddEditWindow({
    idPrefix: "note-form",
    width: 420,
    height: 520,
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
  // KAN-90: players author notes too — but only edit/delete their own, and
  // never targeted handouts (the API enforces both; the UI mirrors it).
  const canCreate = isWriter || myRole === "PLAYER";
  const notes: NoteRow[] = notesData?.noteRoots ?? [];

  function canModify(note: NoteRow): boolean {
    return isWriter || (myRole === "PLAYER" && note.authorId === currentUserId);
  }

  function refetch() {
    reexecuteNotes({ requestPolicy: "network-only" });
  }

  function openCreateWindow() {
    if (!campaignId) {
      return;
    }
    openAddEditWindow<NoteRow>({ mode: "create" }, "New Note", (close) => (
      <NoteFormWindow
        campaignId={campaignId}
        mode={{ mode: "create" }}
        onSaved={refetch}
        onClose={close}
      />
    ));
  }

  function openEditWindow(note: NoteRow) {
    if (!campaignId) {
      return;
    }
    openAddEditWindow<NoteRow>(
      { mode: "edit", item: note },
      `Edit: ${note.title}`,
      (close) => (
        <NoteFormWindow
          campaignId={campaignId}
          mode={{ mode: "edit", item: note }}
          onSaved={refetch}
          onClose={close}
        />
      ),
    );
  }

  function visibilityBadge(note: NoteRow) {
    if (note.visibility === "PRIVATE") {
      return <span className={styles.badge}>Private</span>;
    }

    if (note.visibility === "TARGETED") {
      const forMe = currentUserId
        ? note.recipientIds.includes(currentUserId)
        : false;
      return (
        <span className={`${styles.badge} ${styles.badgeTargeted}`}>
          {forMe ? "For you" : `Handout · ${note.recipientIds.length}`}
        </span>
      );
    }

    return null;
  }

  async function handleDelete(id: string) {
    const result = await deleteNote({ id });
    if (result.data?.deleteNote) {
      setConfirmingDeleteId(null);
      refetch();
    }
  }

  useWindowChromeSync(fetching, refetch);

  if (fetching) {
    return <p>Loading notes…</p>;
  }

  if (error) {
    return <p>{formatGraphQLError(error) ?? "Unable to load notes."}</p>;
  }

  const deleteError = formatGraphQLError(deleteState.error);

  return (
    <div className={styles.wrap}>
      <ul className={styles.list}>
        {notes.map((note) => (
          <li key={note.id} className={styles.row}>
            <button
              type="button"
              className={styles.info}
              onClick={() =>
                canModify(note) ? openEditWindow(note) : undefined
              }
              disabled={!canModify(note)}
            >
              <span className={styles.titleLine}>
                <span className={styles.title}>{note.title}</span>
                {visibilityBadge(note)}
              </span>
              <span className={styles.preview}>{previewOf(note.content)}</span>
            </button>
            {canModify(note) ? (
              <div className={styles.actions}>
                {confirmingDeleteId === note.id ? (
                  <>
                    <FormError>{deleteError}</FormError>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={deleteState.fetching}
                      onClick={() => handleDelete(note.id)}
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
                    onClick={() => setConfirmingDeleteId(note.id)}
                  >
                    <Icon icon={Trash2} size={15} aria-hidden="true" />
                    Delete
                  </Button>
                )}
              </div>
            ) : null}
          </li>
        ))}
        {notes.length === 0 ? (
          <li className={styles.empty}>No notes yet.</li>
        ) : null}
      </ul>

      {canCreate ? (
        <Button type="button" onClick={openCreateWindow}>
          <Icon icon={Plus} size={15} aria-hidden="true" />
          New note
        </Button>
      ) : null}
    </div>
  );
}
