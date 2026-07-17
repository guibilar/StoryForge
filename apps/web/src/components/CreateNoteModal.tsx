import type { FormEvent } from "react";
import { useMutation } from "urql";
import {
  Button,
  Form,
  FormError,
  FormField,
  Input,
  Modal,
  Textarea,
} from "@storyforge/ui";

import { CreateNoteDocument } from "../gql/graphql";
import { useDesktopWindows } from "../lib/DesktopWindowsContext";
import { formatGraphQLError } from "../lib/graphqlError";
import styles from "./CreateNoteModal.module.css";

export interface CreateNoteModalProps {
  open: boolean;
  campaignId: string;
  onClose: () => void;
}

// The "New Note" quick-create form — shared by EntitySidebar's Quick
// Actions and the command palette's "New Note" action. Deliberately minimal
// (title + content only, visibility fixed to SHARED); refine further via
// the Notes window, which has the full editor/visibility/recipients UI.
// Opens the Notes window itself on success (NotesWindow unmounts entirely
// while hidden — see DesktopBoard.tsx — so toggling it visible again is
// enough to pick up the new note on its own fresh fetch, no manual refetch
// needed here).
export function CreateNoteModal({
  open,
  campaignId,
  onClose,
}: CreateNoteModalProps) {
  const { toggle } = useDesktopWindows();
  const [createNoteState, createNote] = useMutation(CreateNoteDocument);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const title = String(form.get("title") ?? "").trim();
    const content = String(form.get("content") ?? "").trim();

    if (!title) {
      return;
    }

    const result = await createNote({
      input: {
        campaignId,
        title,
        content: content || null,
        visibility: "SHARED",
      },
    });
    if (result.data?.createNote) {
      onClose();
      toggle("notes");
    }
  }

  return (
    <Modal open={open} onClose={onClose}>
      <h2>New Note</h2>
      <Form onSubmit={handleSubmit}>
        <FormError>{formatGraphQLError(createNoteState.error)}</FormError>
        <FormField label="Title" htmlFor="create-note-title">
          <Input id="create-note-title" name="title" required />
        </FormField>
        <FormField label="Content" htmlFor="create-note-content">
          <Textarea id="create-note-content" name="content" rows={5} />
        </FormField>
        <div className={styles.modalActions}>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={createNoteState.fetching}>
            Create
          </Button>
        </div>
      </Form>
    </Modal>
  );
}
