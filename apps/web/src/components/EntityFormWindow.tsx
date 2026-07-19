import type { FormEvent } from "react";
import { useMutation } from "urql";
import {
  Button,
  Form,
  FormActions,
  FormError,
  FormField,
  Input,
  Select,
  Textarea,
} from "@storyforge/ui";

import { CreateEntityDocument } from "../gql/graphql";
import type { EntityCategory, EntityVisibility } from "../gql/graphql";
import { formatGraphQLError } from "../lib/graphqlError";
import { useWindowChromeSync } from "../lib/WindowChromeContext";

const VISIBILITIES: EntityVisibility[] = ["PUBLIC", "STORYTELLER", "PRIVATE"];
const CATEGORIES: EntityCategory[] = [
  "CHARACTER",
  "LOCATION",
  "ORGANIZATION",
  "ITEM",
  "OTHER",
];

export interface EntityFormWindowProps {
  campaignId: string;
  onCreated: () => void;
  onClose: () => void;
}

// The "New Entity" quick-create form content — opened as its own window via
// useAddEditWindow instead of nesting a Modal (KAN-108). Create-only for
// now: there's no entity edit flow anywhere in the app yet (EntityWindow's
// Overview tab is read-only), so this doesn't take a create/edit mode.
export function EntityFormWindow({
  campaignId,
  onCreated,
  onClose,
}: EntityFormWindowProps) {
  const [createEntityState, createEntity] = useMutation(CreateEntityDocument);

  // Forms have nothing to "refresh" — only the blocking loading state
  // applies while a save is in flight.
  useWindowChromeSync(createEntityState.fetching);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const type = String(form.get("type") ?? "").trim();
    const category = String(
      form.get("category") ?? CATEGORIES[0],
    ) as EntityCategory;
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
        category,
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
    <Form onSubmit={handleSubmit}>
      <FormError>{formatGraphQLError(createEntityState.error)}</FormError>
      <FormField label="Name" htmlFor="create-entity-name">
        <Input id="create-entity-name" name="name" required />
      </FormField>
      <FormField label="Category" htmlFor="create-entity-category">
        <Select
          id="create-entity-category"
          name="category"
          defaultValue={CATEGORIES[0]}
        >
          {CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField label="Type" htmlFor="create-entity-type">
        <Input
          id="create-entity-type"
          name="type"
          placeholder="e.g. Bandit Chief, Dungeon, Guild"
          required
        />
      </FormField>
      <FormField label="Description" htmlFor="create-entity-description">
        <Textarea id="create-entity-description" name="description" rows={3} />
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
      <FormActions>
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={createEntityState.fetching}>
          Create
        </Button>
      </FormActions>
    </Form>
  );
}
