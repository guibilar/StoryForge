import type { FormEvent } from "react";
import { useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery } from "urql";
import MDEditor from "@uiw/react-md-editor";
import {
  Button,
  Form,
  FormError,
  FormField,
  Input,
  Modal,
} from "@storyforge/ui";

import {
  CampaignDocument,
  CreateNoteDocument,
  DeleteNoteDocument,
  MeDocument,
  NotesDocument,
  UpdateNoteDocument,
} from "../gql/graphql";
import type { NoteVisibility } from "../gql/graphql";
import { formatGraphQLError } from "../lib/graphqlError";
import styles from "./NotesWindow.module.css";

interface NoteRow {
  id: string;
  title: string;
  content: string;
  visibility: NoteVisibility;
  recipientIds: string[];
}

type ModalState = { mode: "create" } | { mode: "edit"; note: NoteRow } | null;

const VISIBILITY_OPTIONS: Array<{ value: NoteVisibility; label: string }> = [
  { value: "SHARED", label: "Shared with everyone" },
  { value: "PRIVATE", label: "Private (Storytellers only)" },
  { value: "TARGETED", label: "Handout for specific players" },
];

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

  const [createState, createNote] = useMutation(CreateNoteDocument);
  const [updateState, updateNote] = useMutation(UpdateNoteDocument);
  const [deleteState, deleteNote] = useMutation(DeleteNoteDocument);

  const [modal, setModal] = useState<ModalState>(null);
  const [dismissedFormError, setDismissedFormError] = useState(false);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(
    null,
  );
  const [modalContent, setModalContent] = useState("");
  const [modalVisibility, setModalVisibility] =
    useState<NoteVisibility>("SHARED");
  const [modalRecipientIds, setModalRecipientIds] = useState<string[]>([]);

  const currentUserId = meData?.me?.id;
  const members = campaignData?.campaign?.members ?? [];
  const myRole = members.find(
    (member) => member.userId === currentUserId,
  )?.role;
  const isWriter =
    myRole === "OWNER" ||
    myRole === "STORYTELLER" ||
    myRole === "CO_STORYTELLER";
  const notes: NoteRow[] = notesData?.noteRoots ?? [];
  const recipientOptions = members.filter(
    (member) => member.userId !== currentUserId,
  );
  const missingRecipients =
    modalVisibility === "TARGETED" && modalRecipientIds.length === 0;

  function refetch() {
    reexecuteNotes({ requestPolicy: "network-only" });
  }

  function openCreateModal() {
    setDismissedFormError(false);
    setModalContent("");
    setModalVisibility("SHARED");
    setModalRecipientIds([]);
    setModal({ mode: "create" });
  }

  function openEditModal(note: NoteRow) {
    setDismissedFormError(false);
    setModalContent(note.content);
    setModalVisibility(note.visibility);
    setModalRecipientIds(note.recipientIds);
    setModal({ mode: "edit", note });
  }

  function closeModal() {
    setModal(null);
    setDismissedFormError(true);
  }

  function toggleRecipient(userId: string) {
    setModalRecipientIds((current) =>
      current.includes(userId)
        ? current.filter((id) => id !== userId)
        : [...current, userId],
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!campaignId || !modal || missingRecipients) {
      return;
    }

    const form = event.currentTarget;
    const data = new FormData(form);
    const title = String(data.get("title") ?? "").trim();

    if (!title) {
      return;
    }

    const visibilityInput = {
      visibility: modalVisibility,
      ...(modalVisibility === "TARGETED"
        ? { recipientIds: modalRecipientIds }
        : {}),
    };

    if (modal.mode === "create") {
      const result = await createNote({
        input: {
          campaignId,
          title,
          content: modalContent,
          ...visibilityInput,
        },
      });
      if (result.data?.createNote) {
        closeModal();
        refetch();
      }
    } else {
      const result = await updateNote({
        input: {
          id: modal.note.id,
          title,
          content: modalContent,
          ...visibilityInput,
        },
      });
      if (result.data?.updateNote) {
        closeModal();
        refetch();
      }
    }
  }

  async function handleDelete(id: string) {
    const result = await deleteNote({ id });
    if (result.data?.deleteNote) {
      setConfirmingDeleteId(null);
      refetch();
    }
  }

  if (fetching) {
    return <p>Loading notes…</p>;
  }

  if (error) {
    return <p>{formatGraphQLError(error) ?? "Unable to load notes."}</p>;
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
        {notes.map((note) => (
          <li key={note.id} className={styles.row}>
            <button
              type="button"
              className={styles.info}
              onClick={() => (isWriter ? openEditModal(note) : undefined)}
              disabled={!isWriter}
            >
              <span className={styles.titleLine}>
                <span className={styles.title}>{note.title}</span>
                {visibilityBadge(note)}
              </span>
              <span className={styles.preview}>{previewOf(note.content)}</span>
            </button>
            {isWriter ? (
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

      {isWriter ? (
        <Button type="button" onClick={openCreateModal}>
          + New note
        </Button>
      ) : null}

      <Modal open={modal !== null} onClose={closeModal}>
        {modal ? (
          <>
            <h2>{modal.mode === "edit" ? "Edit note" : "New note"}</h2>
            <Form onSubmit={handleSubmit}>
              <FormError>{formError}</FormError>
              <FormField label="Title" htmlFor="note-title">
                <Input
                  id="note-title"
                  name="title"
                  defaultValue={modal.mode === "edit" ? modal.note.title : ""}
                  required
                />
              </FormField>
              <FormField label="Content" htmlFor="note-content">
                <div className={styles.editor}>
                  <MDEditor
                    value={modalContent}
                    onChange={(value) => setModalContent(value ?? "")}
                    height={280}
                    preview="live"
                    textareaProps={{ id: "note-content" }}
                  />
                </div>
              </FormField>
              <FormField label="Visibility" htmlFor="note-visibility">
                <select
                  id="note-visibility"
                  className={styles.select}
                  value={modalVisibility}
                  onChange={(event) =>
                    setModalVisibility(event.target.value as NoteVisibility)
                  }
                >
                  {VISIBILITY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </FormField>
              {modalVisibility === "TARGETED" ? (
                <FormField label="Recipients" htmlFor="note-recipients">
                  <div className={styles.recipientChecks} id="note-recipients">
                    {recipientOptions.map((member) => (
                      <label key={member.userId} className={styles.checkPill}>
                        <input
                          type="checkbox"
                          checked={modalRecipientIds.includes(member.userId)}
                          onChange={() => toggleRecipient(member.userId)}
                        />
                        {member.user.email}
                      </label>
                    ))}
                    {recipientOptions.length === 0 ? (
                      <span className={styles.hint}>
                        No other members to hand this out to.
                      </span>
                    ) : null}
                  </div>
                  {missingRecipients ? (
                    <span className={styles.hint}>
                      Select at least one recipient.
                    </span>
                  ) : null}
                </FormField>
              ) : null}
              <div className={styles.modalActions}>
                <Button type="button" variant="secondary" onClick={closeModal}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={
                    createState.fetching ||
                    updateState.fetching ||
                    missingRecipients
                  }
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
