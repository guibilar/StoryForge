import { useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { useMutation, useQuery } from "urql";
import { Paperclip, Pencil, Plus, Trash2 } from "lucide-react";
import { Button, FormError, Icon, IconButton } from "@storyforge/ui";

import {
  CampaignDocument,
  DeleteAttachmentDocument,
  MeDocument,
  NoteDocument,
  UploadNoteAttachmentDocument,
} from "../gql/graphql";
import { useAddEditWindow } from "../hooks/useAddEditWindow";
import { useOpenEntityWindow } from "../hooks/useOpenEntityWindow";
import { useOpenNoteWindow } from "../hooks/useOpenNoteWindow";
import { resolveUploadUrl } from "../lib/apiOrigin";
import { formatGraphQLError } from "../lib/graphqlError";
import { useWindowChromeSync } from "../lib/WindowChromeContext";
import { NoteContent } from "./NoteContent";
import { NoteFormWindow } from "./NoteFormWindow";
import type { NoteRow } from "./NoteFormWindow";
import styles from "./NoteViewWindow.module.css";

// Attachments are stored by the same LocalImageStore the entity/map images
// use (apps/api/src/modules/entities/infrastructure/LocalImageStore.ts), so
// its image-only allowlist and 5MB cap apply here too. Checking client-side
// first avoids uploading a rejected file in full.
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const ACCEPTED_ATTACHMENT_TYPES = "image/jpeg,image/png,image/gif,image/webp";

const VISIBILITY_LABELS: Record<string, string> = {
  SHARED: "Shared",
  PRIVATE: "Private",
  TARGETED: "Handout",
};

export interface NoteViewWindowProps {
  noteId: string;
  campaignId: string;
}

function formatBytes(bytes: number): string {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTimestamp(iso: string): string {
  return iso.slice(0, 10);
}

// Read-first view of a single note — the wiki page half of the split the
// note UI now makes: this window renders, the note-form window edits. Both
// are real desktop windows, so a note can stay open for reference while its
// links are followed into other windows.
export function NoteViewWindow({ noteId, campaignId }: NoteViewWindowProps) {
  const [{ data: meData }] = useQuery({ query: MeDocument });
  const [{ data: campaignData }] = useQuery({
    query: CampaignDocument,
    variables: { id: campaignId },
  });
  const [{ data, fetching, error }, reexecuteNote] = useQuery({
    query: NoteDocument,
    variables: { id: noteId },
  });

  const [uploadState, uploadAttachment] = useMutation(
    UploadNoteAttachmentDocument,
  );
  const [deleteAttachmentState, deleteAttachment] = useMutation(
    DeleteAttachmentDocument,
  );
  const [validationError, setValidationError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const openEntityWindow = useOpenEntityWindow(campaignId);
  const openNoteWindow = useOpenNoteWindow(campaignId);
  const { openAddEditWindow } = useAddEditWindow({
    idPrefix: "note-form",
    width: 420,
    height: 520,
  });

  function refetch() {
    reexecuteNote({ requestPolicy: "network-only" });
  }

  useWindowChromeSync(fetching, refetch);

  const note = data?.note;
  const currentUserId = meData?.me?.id;
  const members = campaignData?.campaign?.members ?? [];
  const myRole = members.find(
    (member) => member.userId === currentUserId,
  )?.role;
  const isWriter =
    myRole === "OWNER" ||
    myRole === "STORYTELLER" ||
    myRole === "CO_STORYTELLER";
  // Mirrors NotesWindow/the API: players own only their own notes.
  const canModify = Boolean(
    note &&
    (isWriter || (myRole === "PLAYER" && note.authorId === currentUserId)),
  );
  // Filing a sub-note only needs *view* rights on the parent (the API's
  // requireViewableParent), so a player can annotate a Storyteller's shared
  // note without being able to edit it. Their sub-note defaults to PRIVATE.
  const canAddSubNote = isWriter || myRole === "PLAYER";

  function openEditWindow() {
    if (!note) {
      return;
    }
    const row: NoteRow = {
      id: note.id,
      authorId: note.authorId,
      title: note.title,
      content: note.content,
      visibility: note.visibility,
      recipientIds: note.recipientIds,
    };
    openAddEditWindow<NoteRow>(
      { mode: "edit", item: row },
      `Edit: ${note.title}`,
      (close) => (
        <NoteFormWindow
          campaignId={campaignId}
          mode={{ mode: "edit", item: row }}
          onSaved={refetch}
          onClose={close}
        />
      ),
    );
  }

  function openCreateSubNoteWindow() {
    if (!note) {
      return;
    }
    const seed = {
      mode: "create" as const,
      key: `child-${note.id}`,
      initial: {
        parentNoteId: note.id,
        visibility: isWriter ? ("SHARED" as const) : ("PRIVATE" as const),
      },
    };
    openAddEditWindow<NoteRow>(
      seed,
      `New note under: ${note.title}`,
      (close) => (
        <NoteFormWindow
          campaignId={campaignId}
          mode={seed}
          onSaved={refetch}
          onClose={close}
        />
      ),
    );
  }

  function openLinkedEntity(entityId: string) {
    const entity = note?.linkedEntities.find((row) => row.id === entityId);
    if (!entity) {
      return;
    }
    openEntityWindow({
      id: entity.id,
      name: entity.name,
      type: entity.type,
      category: entity.category,
      description: entity.description,
      image: entity.image,
      color: entity.color,
      visibility: entity.visibility,
      hiddenFromGraph: entity.hiddenFromGraph,
    });
  }

  function openLinkedNote(targetId: string) {
    const target = [
      ...(note?.linkedNotes ?? []),
      ...(note?.backlinks ?? []),
    ].find((row) => row.id === targetId);
    openNoteWindow(targetId, target?.title ?? "Note");
  }

  async function handleFileSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Reset immediately so picking the same file twice in a row still fires.
    event.target.value = "";
    if (!file) {
      return;
    }

    if (file.size > MAX_ATTACHMENT_BYTES) {
      setValidationError("File size exceeds the maximum limit of 5MB.");
      return;
    }

    setValidationError(null);
    const result = await uploadAttachment({ noteId, file });
    if (result.data?.uploadNoteAttachment) {
      refetch();
    }
  }

  async function handleDeleteAttachment(id: string) {
    const result = await deleteAttachment({ id });
    if (result.data?.deleteAttachment) {
      refetch();
    }
  }

  if (fetching) {
    return <p className={styles.empty}>Loading note…</p>;
  }

  if (error) {
    return (
      <p className={styles.empty}>
        {formatGraphQLError(error) ?? "Unable to load this note."}
      </p>
    );
  }

  if (!note) {
    return <p className={styles.empty}>This note is no longer available.</p>;
  }

  const attachmentError =
    validationError ??
    formatGraphQLError(uploadState.error) ??
    formatGraphQLError(deleteAttachmentState.error);

  return (
    <article className={styles.wrap}>
      <header className={styles.header}>
        <h2 className={styles.title}>{note.title}</h2>
        <div className={styles.meta}>
          <span className={styles.badge}>
            {VISIBILITY_LABELS[note.visibility] ?? note.visibility}
          </span>
          <span>Updated {formatTimestamp(note.updatedAt)}</span>
        </div>
      </header>

      <NoteContent
        content={note.content}
        targets={{ entities: note.linkedEntities, notes: note.linkedNotes }}
        onOpenEntity={openLinkedEntity}
        onOpenNote={openLinkedNote}
      />

      {note.linkedEntities.length > 0 || note.linkedNotes.length > 0 ? (
        <section className={styles.section}>
          <h3 className={styles.sectionLabel}>Links out</h3>
          <div className={styles.chips}>
            {note.linkedEntities.map((entity) => (
              <button
                key={entity.id}
                type="button"
                className={styles.chip}
                onClick={() => openLinkedEntity(entity.id)}
              >
                {entity.name}
              </button>
            ))}
            {note.linkedNotes.map((linked) => (
              <button
                key={linked.id}
                type="button"
                className={styles.chip}
                onClick={() => openNoteWindow(linked.id, linked.title)}
              >
                {linked.title}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <section className={styles.section}>
        <h3 className={styles.sectionLabel}>
          Sub-notes · {note.children.length}
        </h3>
        {note.children.length === 0 ? (
          <p className={styles.empty}>No sub-notes.</p>
        ) : (
          <div className={styles.chips}>
            {note.children.map((child) => (
              <button
                key={child.id}
                type="button"
                className={styles.chip}
                onClick={() => openNoteWindow(child.id, child.title)}
              >
                {child.title}
              </button>
            ))}
          </div>
        )}
        {canAddSubNote ? (
          <Button
            type="button"
            variant="secondary"
            onClick={openCreateSubNoteWindow}
          >
            <Icon icon={Plus} size={15} aria-hidden="true" />
            Add sub-note
          </Button>
        ) : null}
      </section>

      {note.backlinks.length > 0 ? (
        <section className={styles.section}>
          <h3 className={styles.sectionLabel}>
            Referenced by · {note.backlinks.length}
          </h3>
          <div className={styles.chips}>
            {note.backlinks.map((backlink) => (
              <button
                key={backlink.id}
                type="button"
                className={styles.chip}
                onClick={() => openNoteWindow(backlink.id, backlink.title)}
              >
                {backlink.title}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <section className={styles.section}>
        <h3 className={styles.sectionLabel}>
          Attachments · {note.attachments.length}
        </h3>
        {attachmentError ? <FormError>{attachmentError}</FormError> : null}
        {note.attachments.length === 0 ? (
          <p className={styles.empty}>No attachments.</p>
        ) : (
          <ul className={styles.attachmentList}>
            {note.attachments.map((attachment) => (
              <li key={attachment.id} className={styles.attachmentRow}>
                <a
                  className={styles.attachmentLink}
                  href={resolveUploadUrl(attachment.url)}
                  target="_blank"
                  rel="noreferrer"
                >
                  <img
                    className={styles.thumbnail}
                    src={resolveUploadUrl(attachment.url)}
                    alt=""
                  />
                  <span className={styles.attachmentName}>
                    {attachment.fileName}
                  </span>
                  <span className={styles.attachmentSize}>
                    {formatBytes(attachment.sizeBytes)}
                  </span>
                </a>
                {canModify ? (
                  <IconButton
                    icon={Trash2}
                    label={`Delete attachment ${attachment.fileName}`}
                    disabled={deleteAttachmentState.fetching}
                    onClick={() => handleDeleteAttachment(attachment.id)}
                  />
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {canModify ? (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_ATTACHMENT_TYPES}
              className={styles.fileInput}
              aria-label="Attachment file"
              onChange={handleFileSelected}
            />
            <Button
              type="button"
              variant="secondary"
              disabled={uploadState.fetching}
              onClick={() => fileInputRef.current?.click()}
            >
              <Icon icon={Paperclip} size={15} aria-hidden="true" />
              {uploadState.fetching ? "Uploading…" : "Attach image"}
            </Button>
          </>
        ) : null}
      </section>

      {canModify ? (
        <div className={styles.footer}>
          <Button type="button" onClick={openEditWindow}>
            <Icon icon={Pencil} size={15} aria-hidden="true" />
            Edit note
          </Button>
        </div>
      ) : null}
    </article>
  );
}
