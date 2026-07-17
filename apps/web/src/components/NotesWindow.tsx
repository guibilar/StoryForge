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
import { formatGraphQLError } from "../lib/graphqlError";
import styles from "./NotesWindow.module.css";

interface NoteRow {
  id: string;
  title: string;
  content: string;
}

type ModalState = { mode: "create" } | { mode: "edit"; note: NoteRow } | null;

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

  function refetch() {
    reexecuteNotes({ requestPolicy: "network-only" });
  }

  function openCreateModal() {
    setDismissedFormError(false);
    setModalContent("");
    setModal({ mode: "create" });
  }

  function openEditModal(note: NoteRow) {
    setDismissedFormError(false);
    setModalContent(note.content);
    setModal({ mode: "edit", note });
  }

  function closeModal() {
    setModal(null);
    setDismissedFormError(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!campaignId || !modal) {
      return;
    }

    const form = event.currentTarget;
    const data = new FormData(form);
    const title = String(data.get("title") ?? "").trim();

    if (!title) {
      return;
    }

    if (modal.mode === "create") {
      const result = await createNote({
        input: { campaignId, title, content: modalContent },
      });
      if (result.data?.createNote) {
        closeModal();
        refetch();
      }
    } else {
      const result = await updateNote({
        input: { id: modal.note.id, title, content: modalContent },
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
              <span className={styles.title}>{note.title}</span>
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
