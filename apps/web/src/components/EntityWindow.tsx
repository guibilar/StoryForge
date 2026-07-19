import { useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { useMutation, useQuery } from "urql";
import { ImagePlus, Palette, RotateCcw } from "lucide-react";
import { Button, FormError, Icon, Tabs } from "@storyforge/ui";
import type { TabItem } from "@storyforge/ui";

import {
  CampaignDocument,
  EntitiesDocument,
  EntityNotesDocument,
  MeDocument,
  RelationshipsDocument,
  UpdateEntityDocument,
  UploadEntityImageDocument,
} from "../gql/graphql";
import type { EntityCategory, EntityVisibility } from "../gql/graphql";
import { useOpenEntityWindow } from "../hooks/useOpenEntityWindow";
import { useOpenNoteWindow } from "../hooks/useOpenNoteWindow";
import { resolveUploadUrl } from "../lib/apiOrigin";
import { formatGraphQLError } from "../lib/graphqlError";
import { useWindowChromeSync } from "../lib/WindowChromeContext";
import { ForceOpenEntityAction } from "./ForceOpenEntityAction";
import styles from "./EntityWindow.module.css";

// Mirrors LocalImageStore's MAX_BYTES (apps/api/src/modules/entities/infrastructure/LocalImageStore.ts)
// — checking client-side first avoids uploading a large file in full only
// to have the server reject it afterwards.
const MAX_ENTITY_IMAGE_BYTES = 5 * 1024 * 1024;

// Entities that can be placed on the map (KAN-121/122's Marker/Territory
// entityId constraints) — the only ones a map color override is meaningful
// for.
const MAP_LINKABLE_CATEGORIES: EntityCategory[] = ["LOCATION", "ORGANIZATION"];

export interface EntitySummary {
  id: string;
  name: string;
  type: string;
  category: EntityCategory;
  description?: string | null;
  image?: string | null;
  color?: string | null;
  visibility: EntityVisibility;
}

export interface EntityWindowProps {
  entity: EntitySummary;
  campaignId: string;
}

type TabId = "overview" | "relationships" | "notes";

const TABS: TabItem[] = [
  { id: "overview", label: "Overview" },
  { id: "relationships", label: "Relationships" },
  { id: "notes", label: "Notes" },
];

export function EntityWindow({ entity, campaignId }: EntityWindowProps) {
  const [activeTab, setActiveTab] = useState<TabId>("overview");

  return (
    <div className={styles.wrap}>
      <Tabs
        items={TABS}
        activeId={activeTab}
        onChange={(id) => setActiveTab(id as TabId)}
      >
        {activeTab === "overview" ? (
          <OverviewTab entity={entity} campaignId={campaignId} />
        ) : null}
        {activeTab === "relationships" ? (
          <RelationshipsTab campaignId={campaignId} entity={entity} />
        ) : null}
        {activeTab === "notes" ? (
          <NotesTab campaignId={campaignId} entity={entity} />
        ) : null}
      </Tabs>
    </div>
  );
}

function OverviewTab({
  entity,
  campaignId,
}: {
  entity: EntitySummary;
  campaignId: string;
}) {
  const [{ data: meData }] = useQuery({ query: MeDocument });
  const [{ data: campaignData }] = useQuery({
    query: CampaignDocument,
    variables: { id: campaignId },
  });
  const [uploadState, uploadEntityImage] = useMutation(
    UploadEntityImageDocument,
  );
  const [updateEntityState, updateEntity] = useMutation(UpdateEntityDocument);
  // The entity prop is a snapshot from whenever its window was opened, so a
  // freshly uploaded image/color is tracked locally rather than waiting on
  // the caller (EntitySidebar's entity list) to refetch and pass a new prop.
  const [image, setImage] = useState(entity.image ?? null);
  const [color, setColor] = useState(entity.color ?? null);
  // The same window (keyed by `entity:{id}`) can be reopened with a fresher
  // entity prop without unmounting — useDesktopWindowsController overwrites
  // the render function but React reconciles it onto the existing instance,
  // so a useState initializer alone would never see the new snapshot. This
  // resyncs local state during render whenever the prop itself actually
  // changes (React's documented pattern for adjusting state from a changed
  // prop — https://react.dev/learn/you-might-not-need-an-effect), without
  // clobbering an in-session upload/color change (that only updates state
  // directly from the mutation response, not via a new `entity` prop).
  const [prevEntity, setPrevEntity] = useState(entity);
  if (entity !== prevEntity) {
    setPrevEntity(entity);
    setImage(entity.image ?? null);
    setColor(entity.color ?? null);
  }
  const [validationError, setValidationError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const colorInputRef = useRef<HTMLInputElement>(null);

  const isMapLinkable = MAP_LINKABLE_CATEGORIES.includes(entity.category);

  const currentUserId = meData?.me?.id;
  const members = campaignData?.campaign?.members ?? [];
  const myRole = members.find(
    (member) => member.userId === currentUserId,
  )?.role;
  const isWriter =
    myRole === "OWNER" ||
    myRole === "STORYTELLER" ||
    myRole === "CO_STORYTELLER";

  function openFilePicker() {
    fileInputRef.current?.click();
  }

  async function handleFileSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }
    setValidationError(null);
    if (file.size > MAX_ENTITY_IMAGE_BYTES) {
      setValidationError("File size exceeds the maximum limit of 5MB.");
      return;
    }
    const result = await uploadEntityImage({ entityId: entity.id, file });
    if (result.data?.uploadEntityImage) {
      setImage(result.data.uploadEntityImage.image ?? null);
    }
  }

  function openColorPicker() {
    colorInputRef.current?.click();
  }

  async function handleColorSelected(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.value;
    setColor(next);
    const result = await updateEntity({
      input: { id: entity.id, color: next },
    });
    if (result.data?.updateEntity) {
      setColor(result.data.updateEntity.color ?? null);
    }
  }

  async function handleResetColor() {
    setColor(null);
    const result = await updateEntity({
      input: { id: entity.id, color: null },
    });
    if (result.data?.updateEntity) {
      setColor(result.data.updateEntity.color ?? null);
    }
  }

  const actionError =
    validationError ??
    formatGraphQLError(uploadState.error) ??
    formatGraphQLError(updateEntityState.error);

  return (
    <div className={styles.overview}>
      {image ? (
        <img
          className={styles.portrait}
          src={resolveUploadUrl(image)}
          alt={`${entity.name} portrait`}
        />
      ) : (
        <div className={styles.portraitPlaceholder} aria-hidden="true" />
      )}
      <span className={styles.type}>{entity.type}</span>
      <h2 className={styles.name}>{entity.name}</h2>
      <span className={styles.visibility}>{entity.visibility}</span>
      {entity.description ? (
        <p className={styles.description}>{entity.description}</p>
      ) : (
        <p className={styles.empty}>No description yet.</p>
      )}
      {isWriter ? (
        <div className={styles.portraitActions}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            className={styles.hiddenFileInput}
            onChange={handleFileSelected}
          />
          <Button
            type="button"
            variant="secondary"
            disabled={uploadState.fetching}
            onClick={openFilePicker}
          >
            <Icon icon={ImagePlus} size={15} aria-hidden="true" />
            {image ? "Replace Picture" : "Upload Picture"}
          </Button>
          {isMapLinkable ? (
            <div className={styles.colorRow}>
              <input
                ref={colorInputRef}
                type="color"
                // A color input can't be empty — this is only the picker's
                // starting hue when no override is set yet, not a preview of
                // the type-derived colour the map actually falls back to.
                value={color ?? "#3388ff"}
                className={styles.hiddenFileInput}
                onChange={handleColorSelected}
              />
              <Button
                type="button"
                variant="secondary"
                disabled={updateEntityState.fetching}
                onClick={openColorPicker}
              >
                <Icon icon={Palette} size={15} aria-hidden="true" />
                {color ? "Change Map Color" : "Set Map Color"}
              </Button>
              {color ? (
                <>
                  <span
                    className={styles.colorSwatch}
                    style={{ backgroundColor: color }}
                    aria-hidden="true"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={updateEntityState.fetching}
                    onClick={handleResetColor}
                  >
                    <Icon icon={RotateCcw} size={15} aria-hidden="true" />
                    Reset
                  </Button>
                </>
              ) : null}
            </div>
          ) : null}
          {actionError ? <FormError>{actionError}</FormError> : null}
        </div>
      ) : null}
      {isWriter ? (
        <div className={styles.portraitActions}>
          <ForceOpenEntityAction
            campaignId={campaignId}
            entityId={entity.id}
            members={members}
            idPrefix={`entity-window-${entity.id}`}
          />
        </div>
      ) : null}
    </div>
  );
}

function RelationshipsTab({
  campaignId,
  entity,
}: {
  campaignId: string;
  entity: EntitySummary;
}) {
  const openEntityWindow = useOpenEntityWindow(campaignId);

  const [
    { data: entitiesData, fetching: entitiesFetching },
    reexecuteEntities,
  ] = useQuery({
    query: EntitiesDocument,
    variables: { campaignId },
  });
  const [
    { data: relationshipsData, fetching: relationshipsFetching, error },
    reexecuteRelationships,
  ] = useQuery({
    query: RelationshipsDocument,
    variables: { campaignId, entityId: entity.id },
  });

  useWindowChromeSync(entitiesFetching || relationshipsFetching, () => {
    reexecuteEntities({ requestPolicy: "network-only" });
    reexecuteRelationships({ requestPolicy: "network-only" });
  });

  if (entitiesFetching || relationshipsFetching) {
    return <p className={styles.empty}>Loading relationships…</p>;
  }

  if (error) {
    return (
      <p className={styles.empty}>
        {formatGraphQLError(error) ?? "Unable to load relationships."}
      </p>
    );
  }

  const entitiesById = new Map(
    (entitiesData?.entities ?? []).map((row) => [row.id, row]),
  );
  const relationships = relationshipsData?.relationships ?? [];

  if (relationships.length === 0) {
    return <p className={styles.empty}>No recorded relationships yet.</p>;
  }

  function openCounterpart(counterpartId: string) {
    const counterpart = entitiesById.get(counterpartId);
    if (!counterpart) {
      return;
    }
    openEntityWindow({
      id: counterpart.id,
      name: counterpart.name,
      type: counterpart.type,
      category: counterpart.category,
      description: counterpart.description,
      image: counterpart.image,
      color: counterpart.color,
      visibility: counterpart.visibility,
    });
  }

  return (
    <ul className={styles.relationshipList}>
      {relationships.map((relationship) => {
        const counterpartId =
          relationship.sourceEntityId === entity.id
            ? relationship.targetEntityId
            : relationship.sourceEntityId;
        const counterpart = entitiesById.get(counterpartId);

        return (
          <li key={relationship.id} className={styles.relationshipRow}>
            <button
              type="button"
              className={styles.relationshipName}
              onClick={() => openCounterpart(counterpartId)}
              disabled={!counterpart}
            >
              {counterpart?.name ?? "Unknown entity"}
            </button>
            <span className={styles.relationshipType}>{relationship.type}</span>
            {relationship.description ? (
              <p className={styles.relationshipDescription}>
                {relationship.description}
              </p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

// Every note that references this entity through a `[[link]]` — the
// entity's side of the same NoteLink rows the note viewer reads. There is
// no separate "attach note to entity" association: writing the link in a
// note's body is what puts it here.
function NotesTab({
  campaignId,
  entity,
}: {
  campaignId: string;
  entity: EntitySummary;
}) {
  const openNoteWindow = useOpenNoteWindow(campaignId);

  const [{ data, fetching, error }, reexecute] = useQuery({
    query: EntityNotesDocument,
    variables: { id: entity.id },
  });

  useWindowChromeSync(fetching, () =>
    reexecute({ requestPolicy: "network-only" }),
  );

  if (fetching) {
    return <p className={styles.empty}>Loading notes…</p>;
  }

  if (error) {
    return (
      <p className={styles.empty}>
        {formatGraphQLError(error) ?? "Unable to load notes."}
      </p>
    );
  }

  const notes = data?.entity?.backlinks ?? [];

  if (notes.length === 0) {
    return (
      <p className={styles.empty}>
        No notes mention {entity.name} yet. Link one with [[{entity.name}]].
      </p>
    );
  }

  return (
    <ul className={styles.noteList}>
      {notes.map((note) => (
        <li key={note.id} className={styles.noteRow}>
          <button
            type="button"
            className={styles.noteButton}
            onClick={() => openNoteWindow(note.id, note.title)}
          >
            <span className={styles.noteTitle}>{note.title}</span>
            <span className={styles.notePreview}>
              {notePreview(note.content)}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function notePreview(content: string): string {
  // Strip the link syntax so a preview reads as prose, not markup.
  const flat = content
    .replace(/\[\[\s*([^\]|]+?)\s*(?:\|[^\]]+)?\]\]/g, "$1")
    .replace(/\s+/g, " ")
    .trim();

  return flat.length > 100 ? `${flat.slice(0, 100)}…` : flat;
}
