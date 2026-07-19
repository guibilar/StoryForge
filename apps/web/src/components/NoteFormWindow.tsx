import type { FormEvent } from "react";
import { useState } from "react";
import { useMutation, useQuery } from "urql";
import MDEditor from "@uiw/react-md-editor";
import {
  Button,
  Checkbox,
  Form,
  FormActions,
  FormError,
  FormField,
  Input,
  Select,
} from "@storyforge/ui";

import {
  CampaignDocument,
  CreateNoteDocument,
  MeDocument,
  UpdateNoteDocument,
} from "../gql/graphql";
import type { NoteVisibility } from "../gql/graphql";
import type { AddEditMode } from "../hooks/useAddEditWindow";
import { formatGraphQLError } from "../lib/graphqlError";
import { useWindowChromeSync } from "../lib/WindowChromeContext";
import styles from "./NoteFormWindow.module.css";

export interface NoteRow {
  id: string;
  authorId: string;
  title: string;
  content: string;
  visibility: NoteVisibility;
  recipientIds: string[];
}

export interface NoteFormWindowProps {
  campaignId: string;
  mode: AddEditMode<NoteRow>;
  onSaved: () => void;
  onClose: () => void;
}

const VISIBILITY_OPTIONS: Array<{ value: NoteVisibility; label: string }> = [
  { value: "SHARED", label: "Shared with everyone" },
  { value: "PRIVATE", label: "Private (you and Storytellers)" },
  { value: "TARGETED", label: "Handout for specific players" },
];

function sameIds(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((id) => b.includes(id));
}

// The Add/Edit form content for a single note window — opened via
// useAddEditWindow instead of nesting a Modal inside NotesWindow (KAN-107).
// Runs as its own window, so it fetches Me/Campaign independently rather
// than receiving them as props from NotesWindow.
export function NoteFormWindow({
  campaignId,
  mode,
  onSaved,
  onClose,
}: NoteFormWindowProps) {
  const [{ data: meData }] = useQuery({ query: MeDocument });
  const [{ data: campaignData }] = useQuery({
    query: CampaignDocument,
    variables: { id: campaignId },
  });
  const [createState, createNote] = useMutation(CreateNoteDocument);
  const [updateState, updateNote] = useMutation(UpdateNoteDocument);

  // Forms have nothing to "refresh" — only the blocking loading state
  // applies while a save is in flight.
  useWindowChromeSync(createState.fetching || updateState.fetching);

  const initialNote = mode.mode === "edit" ? mode.item : null;
  const [content, setContent] = useState(initialNote?.content ?? "");
  const [visibility, setVisibility] = useState<NoteVisibility>(
    initialNote?.visibility ?? "SHARED",
  );
  const [recipientIds, setRecipientIds] = useState<string[]>(
    initialNote?.recipientIds ?? [],
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
  const authorableOptions = isWriter
    ? VISIBILITY_OPTIONS
    : VISIBILITY_OPTIONS.filter((option) => option.value !== "TARGETED");
  // Keep the select renderable when editing a note whose current level the
  // role can't author (a player's note a Storyteller turned into a handout).
  const visibilityOptions = authorableOptions.some(
    (option) => option.value === visibility,
  )
    ? authorableOptions
    : [
        ...authorableOptions,
        ...VISIBILITY_OPTIONS.filter((option) => option.value === visibility),
      ];
  const recipientOptions = members.filter(
    (member) => member.userId !== currentUserId,
  );
  const missingRecipients =
    visibility === "TARGETED" && recipientIds.length === 0;

  function toggleRecipient(userId: string) {
    setRecipientIds((current) =>
      current.includes(userId)
        ? current.filter((id) => id !== userId)
        : [...current, userId],
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (missingRecipients) {
      return;
    }

    const form = event.currentTarget;
    const data = new FormData(form);
    const title = String(data.get("title") ?? "").trim();

    if (!title) {
      return;
    }

    // Only send visibility/recipients when they changed: an author whose
    // role can't set the note's current level (e.g. a player renaming a note
    // a Storyteller turned into a handout) must still be able to save.
    const visibilityUnchanged =
      mode.mode === "edit" &&
      visibility === mode.item.visibility &&
      (visibility !== "TARGETED" ||
        sameIds(recipientIds, mode.item.recipientIds));
    const visibilityInput = visibilityUnchanged
      ? {}
      : {
          visibility,
          ...(visibility === "TARGETED" ? { recipientIds } : {}),
        };

    if (mode.mode === "create") {
      const result = await createNote({
        input: { campaignId, title, content, ...visibilityInput },
      });
      if (result.data?.createNote) {
        onSaved();
        onClose();
      }
    } else {
      const result = await updateNote({
        input: { id: mode.item.id, title, content, ...visibilityInput },
      });
      if (result.data?.updateNote) {
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
      <FormField label="Title" htmlFor="note-title">
        <Input
          id="note-title"
          name="title"
          defaultValue={initialNote?.title ?? ""}
          required
        />
      </FormField>
      <FormField label="Content" htmlFor="note-content">
        <div className={styles.editor}>
          <MDEditor
            value={content}
            onChange={(value) => setContent(value ?? "")}
            height={280}
            preview="live"
            textareaProps={{ id: "note-content" }}
          />
        </div>
      </FormField>
      <FormField label="Visibility" htmlFor="note-visibility">
        <Select
          id="note-visibility"
          className={styles.select}
          value={visibility}
          onChange={(event) =>
            setVisibility(event.target.value as NoteVisibility)
          }
        >
          {visibilityOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </FormField>
      {visibility === "TARGETED" ? (
        <FormField label="Recipients" htmlFor="note-recipients">
          <div className={styles.recipientChecks} id="note-recipients">
            {recipientOptions.map((member) => (
              <Checkbox
                key={member.userId}
                label={member.user.email}
                checked={recipientIds.includes(member.userId)}
                onChange={() => toggleRecipient(member.userId)}
              />
            ))}
            {recipientOptions.length === 0 ? (
              <span className={styles.hint}>
                No other members to hand this out to.
              </span>
            ) : null}
          </div>
          {missingRecipients ? (
            <span className={styles.hint}>Select at least one recipient.</span>
          ) : null}
        </FormField>
      ) : null}
      <FormActions>
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={
            createState.fetching || updateState.fetching || missingRecipients
          }
        >
          Save
        </Button>
      </FormActions>
    </Form>
  );
}
