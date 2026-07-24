import type { ChangeEvent, FormEvent } from "react";
import { useState } from "react";
import { useMutation, useQuery } from "urql";
import MDEditor, { commands, MarkdownUtil } from "@uiw/react-md-editor";
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
  EntitiesDocument,
  MeDocument,
  NotesDocument,
  UpdateNoteDocument,
} from "../gql/graphql";
import type {
  EntityCategory,
  EntityVisibility,
  NoteVisibility,
} from "../gql/graphql";
import { useColorScheme } from "../hooks/useColorScheme";
import type { AddEditMode } from "../hooks/useAddEditWindow";
import { formatGraphQLError } from "../lib/graphqlError";
import { wikiLinkFor } from "../lib/noteLinks";
import { NoteContent } from "./NoteContent";
import { useWindowChromeSync } from "../lib/WindowChromeContext";
import styles from "./NoteFormWindow.module.css";

// The editor's textarea, reached by id because MDEditor owns the element.
// Used to insert a link at the caret rather than always appending.
const CONTENT_TEXTAREA_ID = "note-content";

// Wraps the selection (or just drops the caret) inside [[ ]] — the syntax
// that both links a note and relates it to an entity. The dropdowns above
// the editor insert a specific target; this is for typing one by name.
const WIKI_LINK_PREFIX = "[[";
const WIKI_LINK_SUFFIX = "]]";

const wikiLinkCommand: commands.ICommand = {
  name: "wikiLink",
  keyCommand: "wikiLink",
  prefix: WIKI_LINK_PREFIX,
  suffix: WIKI_LINK_SUFFIX,
  buttonProps: {
    "aria-label": "Insert a [[link]]",
    title: "Insert a [[link]]",
  },
  icon: (
    <span style={{ fontSize: 12, fontWeight: 700, lineHeight: 1 }}>[[ ]]</span>
  ),
  // Same selectWord/executeCommand dance the built-in bold and link
  // commands use — it is what leaves the caret between the brackets (or
  // wraps the current word) instead of after them.
  execute: (state, api) => {
    const range = MarkdownUtil.selectWord({
      text: state.text,
      selection: state.selection,
      prefix: WIKI_LINK_PREFIX,
      suffix: WIKI_LINK_SUFFIX,
    });
    const selected = api.setSelectionRange(range);
    MarkdownUtil.executeCommand({
      api,
      selectedText: selected.selectedText,
      selection: state.selection,
      prefix: WIKI_LINK_PREFIX,
      suffix: WIKI_LINK_SUFFIX,
    });
  },
};

// Trimmed from the stock GitHub-flavoured toolbar: no table/image/issue/
// comment (a note's images are attachments on the view window, not markdown
// URLs) and only the heading levels a campaign note actually uses.
const TOOLBAR_COMMANDS: commands.ICommand[] = [
  commands.bold,
  commands.italic,
  commands.strikethrough,
  commands.divider,
  commands.title2,
  commands.title3,
  commands.quote,
  commands.divider,
  commands.unorderedListCommand,
  commands.orderedListCommand,
  commands.checkedListCommand,
  commands.divider,
  commands.link,
  wikiLinkCommand,
  commands.code,
];

export interface NoteRow {
  id: string;
  authorId: string;
  title: string;
  content: string;
  visibility: NoteVisibility;
  recipientIds: string[];
  linkedEntities?: Array<{
    id: string;
    name: string;
    type: string;
    category: EntityCategory;
    description: string | null;
    image: string | null;
    color: string | null;
    visibility: EntityVisibility;
    hiddenFromGraph: boolean;
  }>;
  linkedNotes?: Array<{ id: string; title: string }>;
  backlinks?: Array<{ id: string; title: string }>;
  // Set when the note is filed under another note. Only ever supplied as a
  // create-mode seed — re-parenting an existing note is moveNote's job.
  parentNoteId?: string | null;
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
  const colorScheme = useColorScheme();
  const [{ data: meData }] = useQuery({ query: MeDocument });
  const [{ data: campaignData }] = useQuery({
    query: CampaignDocument,
    variables: { id: campaignId },
  });
  const [{ data: entitiesData }] = useQuery({
    query: EntitiesDocument,
    variables: { campaignId },
  });
  // Root notes only, matching the Notes window's own list — enough to link
  // the notes a writer can actually see and name.
  const [{ data: notesData }] = useQuery({
    query: NotesDocument,
    variables: { campaignId },
  });
  const [createState, createNote] = useMutation(CreateNoteDocument);
  const [updateState, updateNote] = useMutation(UpdateNoteDocument);

  // Forms have nothing to "refresh" — only the blocking loading state
  // applies while a save is in flight.
  useWindowChromeSync(createState.fetching || updateState.fetching);

  const initialNote = mode.mode === "edit" ? mode.item : null;
  // Create-mode seeds from a context that already knows part of the answer:
  // an entity's Notes tab pre-links the entity, a note's sub-note button
  // pre-sets the parent, and both pick the visibility the author's role
  // should default to (players default to PRIVATE — see openCreateWindow in
  // EntityWindow/NoteViewWindow).
  const seed = mode.mode === "create" ? mode.initial : undefined;
  const [content, setContent] = useState(
    initialNote?.content ?? seed?.content ?? "",
  );
  const [visibility, setVisibility] = useState<NoteVisibility>(
    initialNote?.visibility ?? seed?.visibility ?? "SHARED",
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
  const entities = entitiesData?.entities ?? [];
  // A note can't link to itself.
  const linkableNotes = (notesData?.noteRoots ?? []).filter(
    (note) => note.id !== initialNote?.id,
  );
  // What the preview pane resolves [[references]] against. The server does
  // the real resolution on save; this mirrors its rules against the same
  // campaign lists so the preview doesn't promise a link that won't stick.
  const linkTargets = { entities, notes: linkableNotes };

  function toggleRecipient(userId: string) {
    setRecipientIds((current) =>
      current.includes(userId)
        ? current.filter((id) => id !== userId)
        : [...current, userId],
    );
  }

  // Relating a note to an entity *is* writing a [[link]] to it: the API
  // parses the content on save and stores the NoteLink rows the entity's
  // Notes tab and the viewer's backlinks read back. So the picker writes
  // the link into the content rather than maintaining a separate field.
  function insertAtCaret(snippet: string) {
    const textarea = document.getElementById(
      CONTENT_TEXTAREA_ID,
    ) as HTMLTextAreaElement | null;

    if (!textarea) {
      setContent((current) => (current ? `${current} ${snippet}` : snippet));
      return;
    }

    const start = textarea.selectionStart ?? content.length;
    const end = textarea.selectionEnd ?? start;
    setContent(content.slice(0, start) + snippet + content.slice(end));

    // Restore the caret after the inserted text once React has re-rendered
    // the textarea with the new value.
    requestAnimationFrame(() => {
      const caret = start + snippet.length;
      textarea.focus();
      textarea.setSelectionRange(caret, caret);
    });
  }

  function handleInsertEntityLink(event: ChangeEvent<HTMLSelectElement>) {
    const entity = entities.find((row) => row.id === event.target.value);
    // Reset so picking the same target twice in a row fires again.
    event.target.value = "";
    if (entity) {
      insertAtCaret(wikiLinkFor("entity", entity.name, entity.id));
    }
  }

  function handleInsertNoteLink(event: ChangeEvent<HTMLSelectElement>) {
    const note = linkableNotes.find((row) => row.id === event.target.value);
    event.target.value = "";
    if (note) {
      insertAtCaret(wikiLinkFor("note", note.title, note.id));
    }
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
        input: {
          campaignId,
          title,
          content,
          ...(seed?.parentNoteId ? { parentNoteId: seed.parentNoteId } : {}),
          ...visibilityInput,
        },
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
    <Form onSubmit={handleSubmit} className={styles.form}>
      <FormError>{formError}</FormError>
      <FormField label="Title" htmlFor="note-title">
        <Input
          id="note-title"
          name="title"
          defaultValue={initialNote?.title ?? seed?.title ?? ""}
          required
        />
      </FormField>
      <FormField
        label="Content"
        htmlFor={CONTENT_TEXTAREA_ID}
        className={styles.contentField}
      >
        <div className={styles.linkBar}>
          <Select
            className={styles.linkSelect}
            aria-label="Insert a link to an entity"
            value=""
            onChange={handleInsertEntityLink}
          >
            <option value="">Link entity…</option>
            {entities.map((entity) => (
              <option key={entity.id} value={entity.id}>
                {entity.name}
              </option>
            ))}
          </Select>
          <Select
            className={styles.linkSelect}
            aria-label="Insert a link to another note"
            value=""
            onChange={handleInsertNoteLink}
          >
            <option value="">Link note…</option>
            {linkableNotes.map((note) => (
              <option key={note.id} value={note.id}>
                {note.title}
              </option>
            ))}
          </Select>
          <span className={styles.hint}>
            Inserts a [[link]] — that's what relates this note to an entity.
          </span>
        </div>
        <div className={styles.editor}>
          <MDEditor
            value={content}
            onChange={(value) => setContent(value ?? "")}
            // Fills the field, which flexes to fill the window — a note
            // window the user drags taller gets a taller editor.
            height="100%"
            // Not "live": at this window's width a split pane leaves two
            // unusably narrow columns. The toolbar's toggle still reaches
            // the preview when it's wanted.
            preview="edit"
            data-color-mode={colorScheme}
            commands={TOOLBAR_COMMANDS}
            extraCommands={[commands.codeEdit, commands.codePreview]}
            components={{
              // The stock preview renders [[Foo]] as literal text. Reusing
              // NoteContent keeps what you see here identical to the note
              // window, resolved against the same campaign lists the link
              // pickers above already loaded.
              preview: (source) => (
                <NoteContent content={source} targets={linkTargets} />
              ),
            }}
            textareaProps={{
              id: CONTENT_TEXTAREA_ID,
              placeholder:
                "Write your note… use [[ ]] to link an entity or another note.",
              spellCheck: true,
            }}
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
