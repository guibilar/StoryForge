import { useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { useMutation, useQuery } from "urql";
import { ImagePlus, Palette, Pencil, Plus, RotateCcw } from "lucide-react";
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
import { useAddEditWindow } from "../hooks/useAddEditWindow";
import { useOpenEntityWindow } from "../hooks/useOpenEntityWindow";
import { useOpenNoteWindow } from "../hooks/useOpenNoteWindow";
import { resolveUploadUrl } from "../lib/apiOrigin";
import { formatGraphQLError } from "../lib/graphqlError";
import { wikiLinkFor } from "../lib/noteLinks";
import { useWindowChromeSync } from "../lib/WindowChromeContext";
import { ForceOpenEntityAction } from "./ForceOpenEntityAction";
import { NoteFormWindow } from "./NoteFormWindow";
import type { NoteRow } from "./NoteFormWindow";
import { RelationshipFormWindow } from "./RelationshipFormWindow";
import type { RelationshipRow } from "./RelationshipFormWindow";
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
  // the caller (the start menu's entity list) to refetch and pass a new prop.
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
  // Same window geometry the graph uses for this form, so editing from either
  // place lands on the same `relationship-form:{id}` window.
  const { openAddEditWindow: openRelationshipWindow } = useAddEditWindow({
    idPrefix: "relationship-form",
    width: 380,
    height: 480,
  });

  const [{ data: meData }] = useQuery({ query: MeDocument });
  const [{ data: campaignData }] = useQuery({
    query: CampaignDocument,
    variables: { id: campaignId },
  });
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

  function refetchRelationships() {
    reexecuteEntities({ requestPolicy: "network-only" });
    reexecuteRelationships({ requestPolicy: "network-only" });
  }

  useWindowChromeSync(
    entitiesFetching || relationshipsFetching,
    refetchRelationships,
  );

  const currentUserId = meData?.me?.id;
  const myRole = (campaignData?.campaign?.members ?? []).find(
    (member) => member.userId === currentUserId,
  )?.role;
  const isWriter =
    myRole === "OWNER" ||
    myRole === "STORYTELLER" ||
    myRole === "CO_STORYTELLER";

  // Until now the only way to edit or delete a relationship was clicking its
  // edge in the graph — a 1.4px line that faction grouping can legitimately
  // hide (a MemberOf edge is absorbed into its hull), leaving the relationship
  // with no reachable delete at all. The entity's own list is the stable path.
  function openEditRelationshipWindow(relationship: RelationshipRow) {
    openRelationshipWindow<RelationshipRow>(
      { mode: "edit", item: relationship },
      `Edit: ${relationship.type}`,
      (close) => (
        <RelationshipFormWindow
          campaignId={campaignId}
          mode={{ mode: "edit", item: relationship }}
          onSaved={refetchRelationships}
          onClose={close}
        />
      ),
    );
  }

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

  type RelationshipEndpoints = {
    sourceEntityId: string | null;
    targetEntityId: string | null;
    concealedEndpoint?: string | null;
  };

  // True when it's *this* entity's own participation that the Storyteller
  // concealed, rather than the counterpart's. The API redacts by blanking the
  // concealed side's id, so the tell is that neither raw field matches
  // entity.id any more — had the counterpart been the concealed one, this
  // entity's id would still be sitting in the field that matches.
  //
  // Storytellers never reach this: canSeeRelationshipEndpoint returns their
  // real ids un-redacted, so the row resolves normally for them.
  function concealsThisEntity(relationship: RelationshipEndpoints): boolean {
    return (
      Boolean(relationship.concealedEndpoint) &&
      relationship.sourceEntityId !== entity.id &&
      relationship.targetEntityId !== entity.id
    );
  }

  // Which side of `relationship` is the counterpart to this entity's own
  // page: whichever raw field isn't this entity. A concealed counterpart
  // (KAN-134) comes back null and renders as "Unknown" below. Rows where our
  // own side is the concealed one never get here — they're filtered out — and
  // null is the safe answer if one ever did.
  function counterpartIdFor(
    relationship: RelationshipEndpoints,
  ): string | null {
    if (relationship.sourceEntityId === entity.id) {
      return relationship.targetEntityId;
    }
    if (relationship.targetEntityId === entity.id) {
      return relationship.sourceEntityId;
    }
    return null;
  }

  // The API filters relationships down to those whose endpoints the viewer
  // can see (relationships/graphql/guards.ts). A `null` counterpart means
  // it's concealed, not invisible — that row still renders as "Unknown"
  // below. Two things do get dropped here:
  //
  //  - a relationship concealing *this* entity's own side. The redaction hides
  //    who the other party is dealing with, so listing it on that party's own
  //    page ("Beatriz Moreau — Blackmails" on the blackmailer's window) hands
  //    back the exact fact being kept. It stays visible from the other
  //    endpoint, and on the graph, as an Unknown counterpart.
  //  - an id that slipped through with no matching entity, which used to
  //    disclose the type and description of a link into an entity the viewer
  //    was never shown.
  const relationships = (relationshipsData?.relationships ?? []).filter(
    (relationship) => {
      if (concealsThisEntity(relationship)) {
        return false;
      }
      const counterpartId = counterpartIdFor(relationship);
      return counterpartId === null || entitiesById.has(counterpartId);
    },
  );

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
        const counterpartId = counterpartIdFor(relationship);
        const counterpart = counterpartId
          ? entitiesById.get(counterpartId)
          : null;

        return (
          <li key={relationship.id} className={styles.relationshipRow}>
            {isWriter ? (
              <button
                type="button"
                className={styles.relationshipEdit}
                aria-label={`Edit relationship: ${relationship.type}`}
                onClick={() => openEditRelationshipWindow(relationship)}
              >
                <Icon icon={Pencil} size={13} aria-hidden="true" />
              </button>
            ) : null}
            <button
              type="button"
              className={styles.relationshipName}
              disabled={!counterpartId}
              onClick={
                counterpartId ? () => openCounterpart(counterpartId) : undefined
              }
            >
              {counterpartId ? counterpart?.name : "Unknown"}
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
  const { openAddEditWindow } = useAddEditWindow({
    idPrefix: "note-form",
    width: 420,
    height: 520,
  });

  const [{ data: meData }] = useQuery({ query: MeDocument });
  const [{ data: campaignData }] = useQuery({
    query: CampaignDocument,
    variables: { id: campaignId },
  });
  const [{ data, fetching, error }, reexecute] = useQuery({
    query: EntityNotesDocument,
    variables: { id: entity.id },
  });

  function refetch() {
    reexecute({ requestPolicy: "network-only" });
  }

  useWindowChromeSync(fetching, refetch);

  const currentUserId = meData?.me?.id;
  const members = campaignData?.campaign?.members ?? [];
  const myRole = members.find(
    (member) => member.userId === currentUserId,
  )?.role;
  const isWriter =
    myRole === "OWNER" ||
    myRole === "STORYTELLER" ||
    myRole === "CO_STORYTELLER";
  // Players may author notes about an entity too (CREATE_NOTE is in their
  // role's permission set) — theirs just default to PRIVATE, which the API
  // reads as "the author and the Storyteller side", not the whole table.
  const canCreate = isWriter || myRole === "PLAYER";

  function openCreateWindow() {
    openAddEditWindow<NoteRow>(
      {
        mode: "create",
        // Keyed by entity so a note started about one entity isn't
        // discarded by starting another about a second.
        key: `entity-${entity.id}`,
        initial: {
          // The link *is* the association — seeding it is what puts the new
          // note in this tab the moment it's saved.
          content: `${wikiLinkFor("entity", entity.name, entity.id)}\n\n`,
          visibility: isWriter ? "SHARED" : "PRIVATE",
        },
      },
      `New note · ${entity.name}`,
      (close) => (
        <NoteFormWindow
          campaignId={campaignId}
          mode={{
            mode: "create",
            key: `entity-${entity.id}`,
            initial: {
              content: `${wikiLinkFor("entity", entity.name, entity.id)}\n\n`,
              visibility: isWriter ? "SHARED" : "PRIVATE",
            },
          }}
          onSaved={refetch}
          onClose={close}
        />
      ),
    );
  }

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

  return (
    <div className={styles.notesTab}>
      {notes.length === 0 ? (
        <p className={styles.empty}>
          No notes mention {entity.name} yet. Link one with [[{entity.name}]].
        </p>
      ) : (
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
      )}

      {canCreate ? (
        <Button type="button" variant="secondary" onClick={openCreateWindow}>
          <Icon icon={Plus} size={15} aria-hidden="true" />
          New note
        </Button>
      ) : null}
    </div>
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
