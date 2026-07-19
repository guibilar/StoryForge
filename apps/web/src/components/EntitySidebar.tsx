import { useState } from "react";
import { useQuery } from "urql";
import type { LucideIcon } from "lucide-react";
import {
  CalendarDays,
  Clock,
  Map as MapIcon,
  Network,
  Plus,
  StickyNote,
  Users,
} from "lucide-react";
import { Button, Icon } from "@storyforge/ui";

import { EntitiesDocument } from "../gql/graphql";
import type { CampaignRole } from "../gql/graphql";
import { useDesktopWindows } from "../lib/DesktopWindowsContext";
import { useAddEditWindow } from "../hooks/useAddEditWindow";
import { useOpenEntityWindow } from "../hooks/useOpenEntityWindow";
import { formatGraphQLError } from "../lib/graphqlError";
import { EntityFormWindow } from "./EntityFormWindow";
import { NoteFormWindow } from "./NoteFormWindow";
import type { NoteRow } from "./NoteFormWindow";
import type { EntitySummary } from "./EntityWindow";
import styles from "./EntitySidebar.module.css";

export interface EntitySidebarProps {
  campaignId: string;
  role?: CampaignRole;
}

// Mirrors the windowCatalog entries (see windowCatalog.ts) as toggle links.
// NPCs have no dedicated catalog window — they're entities of type "NPC",
// reached through the Entities section below like any other entity.
const WORLD_NAV: { id: string; label: string; icon: LucideIcon }[] = [
  { id: "timeline", label: "Timeline", icon: Clock },
  { id: "sessions", label: "Sessions", icon: CalendarDays },
  { id: "notes", label: "Notes", icon: StickyNote },
  { id: "members", label: "Members", icon: Users },
  { id: "relationships", label: "Relationship Graph", icon: Network },
  { id: "maps", label: "Maps", icon: MapIcon },
];

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
  const [collapsedTypes, setCollapsedTypes] = useState<Set<string>>(
    () => new Set(),
  );

  function toggleTypeCollapsed(type: string) {
    setCollapsedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  }

  const openEntityWindow = useOpenEntityWindow(campaignId);
  const { openAddEditWindow: openEntityFormWindow } = useAddEditWindow({
    idPrefix: "entity-form",
    width: 380,
    height: 460,
  });
  const { openAddEditWindow: openNoteFormWindow } = useAddEditWindow({
    idPrefix: "note-form",
    width: 420,
    height: 520,
  });

  const [{ data, fetching, error }, reexecuteEntities] = useQuery({
    query: EntitiesDocument,
    variables: { campaignId },
  });

  const isWriter =
    role === "OWNER" || role === "STORYTELLER" || role === "CO_STORYTELLER";
  const entities: EntitySummary[] = data?.entities ?? [];
  const groups = groupByType(entities);

  function openCreateEntityWindow() {
    openEntityFormWindow<EntitySummary>(
      { mode: "create" },
      "New Entity",
      (close) => (
        <EntityFormWindow
          campaignId={campaignId}
          onCreated={() => reexecuteEntities({ requestPolicy: "network-only" })}
          onClose={close}
        />
      ),
    );
  }

  function openCreateNoteWindow() {
    openNoteFormWindow<NoteRow>({ mode: "create" }, "New Note", (close) => (
      <NoteFormWindow
        campaignId={campaignId}
        mode={{ mode: "create" }}
        // Notes window unmounts entirely while hidden (see DesktopBoard.tsx),
        // so toggling it visible is enough to pick up the new note on its
        // own fresh fetch. If it's already open, leave it be rather than
        // toggling it closed — its own refresh (KAN-110) covers that case.
        onSaved={() => {
          if (layout.notes?.hidden) {
            toggle("notes");
          }
        }}
        onClose={close}
      />
    ));
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
              <Icon icon={item.icon} size={15} aria-hidden="true" />
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
      {groups.map(([type, rows]) => {
        const isCollapsed = collapsedTypes.has(type);
        return (
          <div key={type} className={styles.typeGroup}>
            <button
              type="button"
              className={styles.typeLabel}
              aria-expanded={!isCollapsed}
              onClick={() => toggleTypeCollapsed(type)}
            >
              <span
                className={
                  isCollapsed
                    ? styles.typeChevron
                    : `${styles.typeChevron} ${styles.typeChevronOpen}`
                }
                aria-hidden="true"
              />
              {type} · {rows.length}
            </button>
            {isCollapsed ? null : (
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
            )}
          </div>
        );
      })}

      {isWriter ? (
        <div className={styles.quickActions}>
          <div className={styles.sectionLabel}>Quick Actions</div>
          <Button
            type="button"
            variant="secondary"
            onClick={openCreateEntityWindow}
          >
            <Icon icon={Plus} size={15} aria-hidden="true" />
            New Entity
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={openCreateNoteWindow}
          >
            <Icon icon={Plus} size={15} aria-hidden="true" />
            New Note
          </Button>
        </div>
      ) : null}
    </nav>
  );
}
