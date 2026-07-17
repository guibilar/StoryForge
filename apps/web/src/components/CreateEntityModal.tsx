import type { FormEvent } from "react";
import { useMutation } from "urql";
import {
  Button,
  Form,
  FormError,
  FormField,
  Input,
  Modal,
  Select,
  Textarea,
} from "@storyforge/ui";

import { CreateEntityDocument } from "../gql/graphql";
import type { EntityVisibility } from "../gql/graphql";
import { formatGraphQLError } from "../lib/graphqlError";
import styles from "./CreateEntityModal.module.css";

const VISIBILITIES: EntityVisibility[] = ["PUBLIC", "STORYTELLER", "PRIVATE"];

export interface CreateEntityModalProps {
  open: boolean;
  campaignId: string;
  onClose: () => void;
  onCreated: () => void;
}

// The "New Entity" quick-create form — shared by EntitySidebar's Quick
// Actions and the command palette's "New Entity" action, so there's one
// form to maintain instead of two.
export function CreateEntityModal({
  open,
  campaignId,
  onClose,
  onCreated,
}: CreateEntityModalProps) {
  const [createEntityState, createEntity] = useMutation(CreateEntityDocument);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const type = String(form.get("type") ?? "").trim();
    const description = String(form.get("description") ?? "").trim();
    const visibility = String(
      form.get("visibility") ?? "PUBLIC",
    ) as EntityVisibility;

    if (!name || !type) {
      return;
    }

    const result = await createEntity({
      input: {
        campaignId,
        type,
        name,
        description: description || null,
        visibility,
      },
    });
    if (result.data?.createEntity) {
      onCreated();
      onClose();
    }
  }

  return (
    <Modal open={open} onClose={onClose}>
      <h2>New Entity</h2>
      <Form onSubmit={handleSubmit}>
        <FormError>{formatGraphQLError(createEntityState.error)}</FormError>
        <FormField label="Name" htmlFor="create-entity-name">
          <Input id="create-entity-name" name="name" required />
        </FormField>
        <FormField label="Type" htmlFor="create-entity-type">
          <Input
            id="create-entity-type"
            name="type"
            placeholder="e.g. Character, Location, Item"
            required
          />
        </FormField>
        <FormField label="Description" htmlFor="create-entity-description">
          <Textarea
            id="create-entity-description"
            name="description"
            rows={3}
          />
        </FormField>
        <FormField label="Visibility" htmlFor="create-entity-visibility">
          <Select
            id="create-entity-visibility"
            name="visibility"
            defaultValue="PUBLIC"
          >
            {VISIBILITIES.map((visibility) => (
              <option key={visibility} value={visibility}>
                {visibility}
              </option>
            ))}
          </Select>
        </FormField>
        <div className={styles.modalActions}>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={createEntityState.fetching}>
            Create
          </Button>
        </div>
      </Form>
    </Modal>
  );
}
