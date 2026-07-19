import type { FormEvent } from "react";
import { useState } from "react";
import { useMutation } from "urql";
import {
  Button,
  Checkbox,
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
// Entities that can be placed on the map (KAN-121/122's Marker/Territory
// entityId constraints) — the only ones a map color is meaningful for.
const MAP_LINKABLE_CATEGORIES: EntityCategory[] = ["LOCATION", "ORGANIZATION"];

export interface EntityFormWindowProps {
  campaignId: string;
  onCreated: () => void;
  onClose: () => void;
}

// The "New Entity" quick-create form content — opened as its own window via
// useAddEditWindow instead of nesting a Modal (KAN-108). Create-only for
// now: there's no entity edit flow anywhere in the app yet for its text
// fields (EntityWindow's Overview tab only supports uploading a picture,
// not editing name/type/description), so this doesn't take a create/edit mode.
export function EntityFormWindow({
  campaignId,
  onCreated,
  onClose,
}: EntityFormWindowProps) {
  const [createEntityState, createEntity] = useMutation(CreateEntityDocument);
  const [category, setCategory] = useState<EntityCategory>(CATEGORIES[0]);
  const [isPlayerCharacter, setIsPlayerCharacter] = useState(false);
  const [color, setColor] = useState<string | null>(null);

  // Forms have nothing to "refresh" — only the blocking loading state
  // applies while a save is in flight.
  useWindowChromeSync(createEntityState.fetching);

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
        category,
        name,
        description: description || null,
        visibility,
        isPlayerCharacter: category === "CHARACTER" && isPlayerCharacter,
        color: MAP_LINKABLE_CATEGORIES.includes(category) ? color : null,
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
          value={category}
          onChange={(event) => {
            const nextCategory = event.target.value as EntityCategory;
            setCategory(nextCategory);
            if (nextCategory !== "CHARACTER") {
              setIsPlayerCharacter(false);
            }
            if (!MAP_LINKABLE_CATEGORIES.includes(nextCategory)) {
              setColor(null);
            }
          }}
        >
          {CATEGORIES.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </Select>
      </FormField>
      {category === "CHARACTER" ? (
        <Checkbox
          label="Player Character"
          checked={isPlayerCharacter}
          onChange={(event) => setIsPlayerCharacter(event.target.checked)}
        />
      ) : null}
      {MAP_LINKABLE_CATEGORIES.includes(category) ? (
        <FormField label="Map Color" htmlFor="create-entity-color">
          <Input
            id="create-entity-color"
            name="color"
            type="color"
            value={color ?? "#3388ff"}
            onChange={(event) => setColor(event.target.value)}
          />
        </FormField>
      ) : null}
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
