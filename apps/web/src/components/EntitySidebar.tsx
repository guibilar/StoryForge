import { useState } from "react";
import { useQuery } from "urql";
import { Button } from "@storyforge/ui";

import { EntitiesDocument } from "../gql/graphql";
import type { CampaignRole } from "../gql/graphql";
import { useDesktopWindows } from "../lib/DesktopWindowsContext";
import { useOpenEntityWindow } from "../hooks/useOpenEntityWindow";
import { formatGraphQLError } from "../lib/graphqlError";
import { CreateEntityModal } from "./CreateEntityModal";
import { CreateNoteModal } from "./CreateNoteModal";
import type { EntitySummary } from "./EntityWindow";
import styles from "./EntitySidebar.module.css";

export interface EntitySidebarProps {
  campaignId: string;
  role?: CampaignRole;
}

// The 5 existing windowCatalog entries other than "npcs" — NPCs are reached
// through the Entities section below instead (they're just entities of type
// "NPC"), so surfacing a separate "NPCs" nav toggle here would be redundant.
const WORLD_NAV: { id: string; label: string }[] = [
  { id: "timeline", label: "Timeline" },
  { id: "sessions", label: "Sessions" },
  { id: "notes", label: "Notes" },
  { id: "members", label: "Members" },
  { id: "relationships", label: "Relationship Graph" },
];

type QuickAction = "entity" | "note" | null;

function groupByType(entities: EntitySummary[]): [string, EntitySummary[]][] {
  const groups = new Map<string, EntitySummary[]>();
  for (const entity of entities) {
    const list = groups.get(entity.type) ?? [];
    list.push(entity);
    groups.set(entity.type, list);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
}

export function EntitySidebar({ campaignId, role }: EntitySidebarProps) {
  const { layout, toggle } = useDesktopWindows();
  const openEntityWindow = useOpenEntityWindow(campaignId);

  const [{ data, fetching, error }, reexecuteEntities] = useQuery({
    query: EntitiesDocument,
    variables: { campaignId },
  });

  const [quickAction, setQuickAction] = useState<QuickAction>(null);

  const isWriter =
    role === "OWNER" || role === "STORYTELLER" || role === "CO_STORYTELLER";
  const entities: EntitySummary[] = data?.entities ?? [];
  const groups = groupByType(entities);

  function closeQuickAction() {
    setQuickAction(null);
  }

  return (
    <nav className={styles.wrap} aria-label="Campaign navigation">
      <div className={styles.sectionLabel}>World</div>
      <ul className={styles.navList}>
        {WORLD_NAV.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              className={
                !layout[item.id]?.hidden
                  ? `${styles.navItem} ${styles.navItemOpen}`
                  : styles.navItem
              }
              onClick={() => toggle(item.id)}
            >
              {item.label}
            </button>
          </li>
        ))}
      </ul>

      <div className={styles.sectionLabel}>Entities</div>
      {fetching ? <p className={styles.empty}>Loading entities…</p> : null}
      {error ? (
        <p className={styles.empty}>
          {formatGraphQLError(error) ?? "Unable to load entities."}
        </p>
      ) : null}
      {!fetching && !error && entities.length === 0 ? (
        <p className={styles.empty}>No entities yet.</p>
      ) : null}
      {groups.map(([type, rows]) => (
        <div key={type} className={styles.typeGroup}>
          <div className={styles.typeLabel}>
            {type} · {rows.length}
          </div>
          <ul className={styles.entityList}>
            {rows.map((entity) => (
              <li key={entity.id}>
                <button
                  type="button"
                  className={styles.entityRow}
                  onClick={() => openEntityWindow(entity)}
                >
                  {entity.name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}

      {isWriter ? (
        <div className={styles.quickActions}>
          <div className={styles.sectionLabel}>Quick Actions</div>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setQuickAction("entity")}
          >
            + New Entity
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setQuickAction("note")}
          >
            + New Note
          </Button>
        </div>
      ) : null}

      <CreateEntityModal
        open={quickAction === "entity"}
        campaignId={campaignId}
        onClose={closeQuickAction}
        onCreated={() => reexecuteEntities({ requestPolicy: "network-only" })}
      />
      <CreateNoteModal
        open={quickAction === "note"}
        campaignId={campaignId}
        onClose={closeQuickAction}
      />
    </nav>
  );
}
