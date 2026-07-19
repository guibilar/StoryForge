import { useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { useMutation, useQuery } from "urql";
import { Button, FormError, Tabs } from "@storyforge/ui";
import type { TabItem } from "@storyforge/ui";

import {
  CampaignDocument,
  EntitiesDocument,
  MeDocument,
  RelationshipsDocument,
  UploadEntityImageDocument,
} from "../gql/graphql";
import type { EntityVisibility } from "../gql/graphql";
import { useOpenEntityWindow } from "../hooks/useOpenEntityWindow";
import { resolveUploadUrl } from "../lib/apiOrigin";
import { formatGraphQLError } from "../lib/graphqlError";
import { useWindowChromeSync } from "../lib/WindowChromeContext";
import { ForceOpenEntityAction } from "./ForceOpenEntityAction";
import styles from "./EntityWindow.module.css";

// Mirrors LocalImageStore's MAX_BYTES (apps/api/src/modules/entities/infrastructure/LocalImageStore.ts)
// — checking client-side first avoids uploading a large file in full only
// to have the server reject it afterwards.
const MAX_ENTITY_IMAGE_BYTES = 5 * 1024 * 1024;

export interface EntitySummary {
  id: string;
  name: string;
  type: string;
  description?: string | null;
  image?: string | null;
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
        {activeTab === "notes" ? <NotesTab /> : null}
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
  // The entity prop is a snapshot from whenever its window was opened, so a
  // freshly uploaded image is tracked locally rather than waiting on the
  // caller (EntitySidebar's entity list) to refetch and pass a new prop.
  const [image, setImage] = useState(entity.image ?? null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const actionError = validationError ?? formatGraphQLError(uploadState.error);

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
            {image ? "Replace Picture" : "Upload Picture"}
          </Button>
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
      description: counterpart.description,
      image: counterpart.image,
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

function NotesTab() {
  return <p className={styles.empty}>Notes — coming soon.</p>;
}
