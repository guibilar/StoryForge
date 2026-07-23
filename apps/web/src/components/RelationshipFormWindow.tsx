import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "urql";
import { Trash2 } from "lucide-react";
import {
  Button,
  Checkbox,
  Form,
  FormActions,
  FormError,
  FormField,
  Icon,
  Input,
  Select,
  Textarea,
} from "@storyforge/ui";

import {
  CampaignDocument,
  CreateRelationshipDocument,
  DeleteRelationshipDocument,
  EntitiesDocument,
  MeDocument,
  UpdateRelationshipDocument,
} from "../gql/graphql";
import type { RelationshipVisibility } from "../gql/graphql";
import type { AddEditMode } from "../hooks/useAddEditWindow";
import { formatGraphQLError } from "../lib/graphqlError";
import { suggestRelationshipTypes } from "../lib/relationshipTypeSuggestions";
import { useWindowChromeSync } from "../lib/WindowChromeContext";
import { EntitySelectField } from "./EntitySelectField";

export interface RelationshipRow {
  id: string;
  sourceEntityId: string;
  targetEntityId: string;
  type: string;
  description?: string | null;
  visibility: RelationshipVisibility;
  recipientIds: string[];
}

export interface RelationshipFormWindowProps {
  campaignId: string;
  mode: AddEditMode<RelationshipRow>;
  onSaved: () => void;
  onClose: () => void;
}

// Only Storytellers reach this form (createRelationship/updateRelationship
// are writer-only — KAN-41), so every level is authorable; unlike a note's
// visibility select there's no role to filter the options against.
const VISIBILITY_OPTIONS: Array<{
  value: RelationshipVisibility;
  label: string;
}> = [
  { value: "PUBLIC", label: "Public (anyone who sees both entities)" },
  { value: "STORYTELLER", label: "Storytellers only" },
  { value: "TARGETED", label: "Targeted at specific players" },
];

function sameIds(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((id) => b.includes(id));
}

function entityLabel(
  entities: { id: string; name: string }[] | undefined,
  entityId: string,
): string {
  return entities?.find((entity) => entity.id === entityId)?.name ?? entityId;
}

// The Add/Edit form content for a single relationship edge — opened via
// useAddEditWindow, same pattern as MarkerFormWindow/TerritoryFormWindow.
// Source/target are only settable at creation: UpdateRelationshipInput has
// no sourceEntityId/targetEntityId (KAN-41 — repoint by deleting and
// recreating, not by editing in place), so edit mode shows them read-only.
// No category restriction on either picker — unlike Marker/Territory
// (KAN-121/122), a Relationship connects any two entities regardless of
// category; the type suggestions below (KAN-123) are a hint, not a
// constraint — Relationship.type stays a free string (KAN-41) so future
// plugins can still define their own values.
export function RelationshipFormWindow({
  campaignId,
  mode,
  onSaved,
  onClose,
}: RelationshipFormWindowProps) {
  const [createState, createRelationship] = useMutation(
    CreateRelationshipDocument,
  );
  const [updateState, updateRelationship] = useMutation(
    UpdateRelationshipDocument,
  );
  const [deleteState, deleteRelationship] = useMutation(
    DeleteRelationshipDocument,
  );
  const [validationError, setValidationError] = useState<string | null>(null);

  const initial: Partial<RelationshipRow> | null =
    mode.mode === "edit" ? mode.item : (mode.initial ?? null);

  const [sourceEntityId, setSourceEntityId] = useState(
    initial?.sourceEntityId ?? "",
  );

  const [targetEntityId, setTargetEntityId] = useState(
    initial?.targetEntityId ?? "",
  );

  const [visibility, setVisibility] = useState<RelationshipVisibility>(
    initial?.visibility ?? "PUBLIC",
  );
  const [recipientIds, setRecipientIds] = useState<string[]>(
    initial?.recipientIds ?? [],
  );

  const [{ data: entitiesData }] = useQuery({
    query: EntitiesDocument,
    variables: { campaignId },
    pause: !campaignId,
  });

  const [{ data: meData }] = useQuery({ query: MeDocument });
  const [{ data: campaignData }] = useQuery({
    query: CampaignDocument,
    variables: { id: campaignId },
    pause: !campaignId,
  });

  const currentUserId = meData?.me?.id;
  // Target anyone in the campaign other than yourself — you already see the
  // edge you're authoring.
  const recipientOptions = (campaignData?.campaign?.members ?? []).filter(
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

  const suggestions = useMemo(() => {
    const entities = entitiesData?.entities ?? [];
    const source = entities.find((entity) => entity.id === sourceEntityId);
    const target = entities.find((entity) => entity.id === targetEntityId);
    return suggestRelationshipTypes(source?.category, target?.category);
  }, [entitiesData, sourceEntityId, targetEntityId]);

  // Forms have nothing to "refresh" — only the blocking loading state
  // applies while a save is in flight.
  useWindowChromeSync(
    createState.fetching || updateState.fetching || deleteState.fetching,
  );

  async function handleDelete() {
    if (mode.mode !== "edit") {
      return;
    }
    const result = await deleteRelationship({ id: mode.item.id });
    if (result.data?.deleteRelationship) {
      onSaved();
      onClose();
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setValidationError(null);

    const data = new FormData(event.currentTarget);
    const type = String(data.get("type") ?? "").trim();
    const description = String(data.get("description") ?? "").trim();

    // `required` alone doesn't stop a whitespace-only value (the browser
    // only checks the raw value is non-empty) — check the trimmed type
    // explicitly and surface it, instead of silently doing nothing.
    if (!type) {
      setValidationError("Type is required.");
      return;
    }

    if (missingRecipients) {
      setValidationError("Select at least one recipient.");
      return;
    }

    if (mode.mode === "create") {
      if (!sourceEntityId || !targetEntityId) {
        setValidationError("Source and target entities are required.");
        return;
      }
      if (sourceEntityId === targetEntityId) {
        setValidationError("Source and target must be different entities.");
        return;
      }

      const result = await createRelationship({
        input: {
          campaignId,
          sourceEntityId,
          targetEntityId,
          type,
          description: description || null,
          visibility,
          ...(visibility === "TARGETED" ? { recipientIds } : {}),
        },
      });
      if (result.data?.createRelationship) {
        onSaved();
        onClose();
      }
    } else {
      // Only send visibility/recipients when they changed, mirroring
      // NoteFormWindow — the service keeps existing recipients on an
      // unchanged level and drops them when the level moves.
      const visibilityUnchanged =
        visibility === mode.item.visibility &&
        (visibility !== "TARGETED" ||
          sameIds(recipientIds, mode.item.recipientIds));
      const visibilityInput = visibilityUnchanged
        ? {}
        : {
            visibility,
            ...(visibility === "TARGETED" ? { recipientIds } : {}),
          };

      const result = await updateRelationship({
        input: {
          id: mode.item.id,
          type,
          description: description || null,
          ...visibilityInput,
        },
      });
      if (result.data?.updateRelationship) {
        onSaved();
        onClose();
      }
    }
  }

  const formError =
    validationError ??
    formatGraphQLError(
      mode.mode === "create"
        ? createState.error
        : (updateState.error ?? deleteState.error),
    );

  return (
    <Form onSubmit={handleSubmit}>
      <FormError>{formError}</FormError>
      {mode.mode === "create" ? (
        <>
          <EntitySelectField
            campaignId={campaignId}
            id="relationship-source"
            name="sourceEntityId"
            label="Source"
            defaultValue={sourceEntityId}
            required
            promptSelection
            onChange={setSourceEntityId}
          />
          <EntitySelectField
            campaignId={campaignId}
            id="relationship-target"
            name="targetEntityId"
            label="Target"
            defaultValue={targetEntityId}
            required
            promptSelection
            onChange={setTargetEntityId}
          />
        </>
      ) : (
        <>
          <FormField label="Source" htmlFor="relationship-source-readonly">
            <Input
              id="relationship-source-readonly"
              value={entityLabel(entitiesData?.entities, sourceEntityId)}
              readOnly
              disabled
            />
          </FormField>
          <FormField label="Target" htmlFor="relationship-target-readonly">
            <Input
              id="relationship-target-readonly"
              value={entityLabel(entitiesData?.entities, targetEntityId)}
              readOnly
              disabled
            />
          </FormField>
        </>
      )}
      <FormField label="Type" htmlFor="relationship-type">
        <Input
          id="relationship-type"
          name="type"
          list="relationship-type-suggestions"
          placeholder="e.g. Ally, MemberOf, Owns"
          defaultValue={initial?.type ?? ""}
          required
        />
        <datalist id="relationship-type-suggestions">
          {suggestions.map((suggestion) => (
            <option key={suggestion} value={suggestion} />
          ))}
        </datalist>
      </FormField>
      <FormField label="Description" htmlFor="relationship-description">
        <Textarea
          id="relationship-description"
          name="description"
          defaultValue={initial?.description ?? ""}
          rows={3}
        />
      </FormField>
      <FormField label="Visibility" htmlFor="relationship-visibility">
        <Select
          id="relationship-visibility"
          value={visibility}
          onChange={(event) =>
            setVisibility(event.target.value as RelationshipVisibility)
          }
        >
          {VISIBILITY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </FormField>
      {visibility === "TARGETED" ? (
        <FormField label="Recipients" htmlFor="relationship-recipients">
          <div id="relationship-recipients">
            {recipientOptions.map((member) => (
              <Checkbox
                key={member.userId}
                label={member.user.email}
                checked={recipientIds.includes(member.userId)}
                onChange={() => toggleRecipient(member.userId)}
              />
            ))}
            {recipientOptions.length === 0 ? (
              <span>No other members to target.</span>
            ) : null}
          </div>
        </FormField>
      ) : null}
      <FormActions>
        {mode.mode === "edit" ? (
          <Button
            type="button"
            variant="secondary"
            disabled={deleteState.fetching}
            onClick={handleDelete}
          >
            <Icon icon={Trash2} size={15} aria-hidden="true" />
            Delete
          </Button>
        ) : null}
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
