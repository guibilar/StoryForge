import { useState } from "react";
import { useQuery } from "urql";
import { Tabs } from "@storyforge/ui";
import type { TabItem } from "@storyforge/ui";

import { EntitiesDocument, RelationshipsDocument } from "../gql/graphql";
import type { EntityVisibility } from "../gql/graphql";
import { useDesktopWindows } from "../lib/DesktopWindowsContext";
import { formatGraphQLError } from "../lib/graphqlError";
import styles from "./EntityWindow.module.css";

export interface EntitySummary {
  id: string;
  name: string;
  type: string;
  description?: string | null;
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

const DEFAULT_ENTITY_WINDOW = { width: 380, height: 420 };

export function EntityWindow({ entity, campaignId }: EntityWindowProps) {
  const [activeTab, setActiveTab] = useState<TabId>("overview");

  return (
    <div className={styles.wrap}>
      <Tabs
        items={TABS}
        activeId={activeTab}
        onChange={(id) => setActiveTab(id as TabId)}
      >
        {activeTab === "overview" ? <OverviewTab entity={entity} /> : null}
        {activeTab === "relationships" ? (
          <RelationshipsTab campaignId={campaignId} entity={entity} />
        ) : null}
        {activeTab === "notes" ? <NotesTab /> : null}
      </Tabs>
    </div>
  );
}

function OverviewTab({ entity }: { entity: EntitySummary }) {
  return (
    <div className={styles.overview}>
      <span className={styles.type}>{entity.type}</span>
      <h2 className={styles.name}>{entity.name}</h2>
      <span className={styles.visibility}>{entity.visibility}</span>
      {entity.description ? (
        <p className={styles.description}>{entity.description}</p>
      ) : (
        <p className={styles.empty}>No description yet.</p>
      )}
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
  const { openWindow, dynamicWindows } = useDesktopWindows();

  const [{ data: entitiesData, fetching: entitiesFetching }] = useQuery({
    query: EntitiesDocument,
    variables: { campaignId },
  });
  const [{ data: relationshipsData, fetching: relationshipsFetching, error }] =
    useQuery({
      query: RelationshipsDocument,
      variables: { campaignId, entityId: entity.id },
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
    const offset = (Object.keys(dynamicWindows).length % 6) * 24;
    openWindow({
      id: `entity:${counterpart.id}`,
      title: counterpart.name,
      render: () => (
        <EntityWindow
          entity={{
            id: counterpart.id,
            name: counterpart.name,
            type: counterpart.type,
            description: counterpart.description,
            visibility: counterpart.visibility,
          }}
          campaignId={campaignId}
        />
      ),
      x: 140 + offset,
      y: 80 + offset,
      width: DEFAULT_ENTITY_WINDOW.width,
      height: DEFAULT_ENTITY_WINDOW.height,
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
