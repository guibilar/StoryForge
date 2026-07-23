import { useEffect, useMemo, useRef, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { useQuery } from "urql";
import { Icon, Link } from "@storyforge/ui";
import { ArrowLeft, LayoutGrid, Plus, Save } from "lucide-react";

import { EntitiesDocument } from "../gql/graphql";
import type { CampaignRole } from "../gql/graphql";
import { useDesktopWindows } from "../lib/DesktopWindowsContext";
import { visibleWindowCatalog } from "../lib/windowCatalog";
import { groupByType } from "../lib/entityGroups";
import { scoreMatch } from "../lib/commandScore";
import { formatGraphQLError } from "../lib/graphqlError";
import { useOpenEntityWindow } from "../hooks/useOpenEntityWindow";
import { useQuickCreateWindows } from "../hooks/useQuickCreateWindows";
import type { EntitySummary } from "./EntityWindow";
import styles from "./StartMenu.module.css";

export interface StartMenuProps {
  campaignId: string;
  campaignName: string;
  role?: CampaignRole;
  userEmail?: string;
  onClose: () => void;
}

// Navigation for the whole campaign desktop: the windows you can open, the
// entities in this campaign, what you opened recently, the create actions,
// and your saved layouts. Its search box is deliberately a shallow filter
// over what the menu already shows — the ⌘K command palette
// (AppCommandPalette) is still the deep search across notes and sessions.
export function StartMenu({
  campaignId,
  campaignName,
  role,
  userEmail,
  onClose,
}: StartMenuProps) {
  const {
    layout,
    toggle,
    restoreWindow,
    bringToFront,
    recentIds,
    presets,
    savePreset,
    applyPreset,
  } = useDesktopWindows();
  const [query, setQuery] = useState("");
  const [collapsedTypes, setCollapsedTypes] = useState<Set<string>>(
    () => new Set(),
  );
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const openEntityWindow = useOpenEntityWindow(campaignId);
  const [{ data, fetching, error }, reexecuteEntities] = useQuery({
    query: EntitiesDocument,
    variables: { campaignId },
  });
  const { openCreateEntityWindow, openCreateNoteWindow } =
    useQuickCreateWindows(campaignId, {
      onEntityCreated: () =>
        reexecuteEntities({ requestPolicy: "network-only" }),
    });

  const catalog = useMemo(() => visibleWindowCatalog(role), [role]);
  const entities: EntitySummary[] = useMemo(() => data?.entities ?? [], [data]);
  const isWriter =
    role === "OWNER" || role === "STORYTELLER" || role === "CO_STORYTELLER";
  const presetNames = Object.keys(presets);

  // Mounted only while it is open (CampaignDesktopPage renders it
  // conditionally), so opening always starts from an empty search box and
  // there is nothing to reset on the way out.
  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      const target = event.target as HTMLElement;
      // The start button toggles the menu itself; closing here too would
      // close and immediately reopen it.
      if (
        panelRef.current?.contains(target) ||
        target.closest("[data-start]")
      ) {
        return;
      }
      onClose();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const trimmedQuery = query.trim();
  const isSearching = trimmedQuery.length > 0;

  const windowMatches = useMemo(
    () =>
      catalog.filter(
        (entry) => !isSearching || scoreMatch(trimmedQuery, entry.title) >= 0,
      ),
    [catalog, isSearching, trimmedQuery],
  );
  const entityMatches = useMemo(
    () =>
      entities
        .map((entity) => ({
          entity,
          score: scoreMatch(trimmedQuery, entity.name),
        }))
        .filter((row) => row.score >= 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 20)
        .map((row) => row.entity),
    [entities, trimmedQuery],
  );
  const recentEntities = useMemo(
    () =>
      recentIds
        .map((id) => entities.find((entity) => entity.id === id))
        .filter((entity): entity is EntitySummary => Boolean(entity))
        .slice(0, 5),
    [recentIds, entities],
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

  function openWindowById(id: string) {
    const window = layout[id];
    if (!window || window.hidden) {
      toggle(id);
    } else if (window.minimized) {
      restoreWindow(id);
    } else {
      bringToFront(id);
    }
    onClose();
  }

  function openEntity(entity: EntitySummary) {
    openEntityWindow(entity);
    onClose();
  }

  function handleSavePreset() {
    const name = window.prompt("Name this layout:")?.trim();
    if (name) {
      savePreset(name);
    }
    onClose();
  }

  return (
    <div
      className={styles.panel}
      ref={panelRef}
      role="dialog"
      aria-label="Start menu"
    >
      <div className={styles.header}>
        <h2 className={styles.campaign}>{campaignName}</h2>
        <input
          ref={searchRef}
          type="search"
          className={styles.search}
          placeholder="Search windows and entities…"
          aria-label="Search windows and entities"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      <div className={styles.scroll}>
        <p className={styles.sectionLabel}>
          {isSearching ? "Windows" : "World"}
        </p>
        {windowMatches.length === 0 ? (
          <p className={styles.empty}>No matching windows.</p>
        ) : (
          <div className={styles.windowGrid}>
            {windowMatches.map((entry) => (
              <button
                key={entry.id}
                type="button"
                className={styles.windowTile}
                data-open={!layout[entry.id]?.hidden}
                onClick={() => openWindowById(entry.id)}
              >
                <Icon icon={entry.icon} size={20} aria-hidden="true" />
                <span>{entry.title}</span>
              </button>
            ))}
          </div>
        )}

        {!isSearching && recentEntities.length > 0 ? (
          <>
            <p className={styles.sectionLabel}>Recent</p>
            <ul className={styles.rows}>
              {recentEntities.map((entity) => (
                <li key={entity.id}>
                  <button
                    type="button"
                    className={styles.row}
                    onClick={() => openEntity(entity)}
                  >
                    {entity.name}
                    <span className={styles.rowMeta}>{entity.type}</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : null}

        <p className={styles.sectionLabel}>Entities</p>
        {fetching ? <p className={styles.empty}>Loading entities…</p> : null}
        {error ? (
          <p className={styles.empty}>
            {formatGraphQLError(error) ?? "Unable to load entities."}
          </p>
        ) : null}
        {!fetching && !error && entityMatches.length === 0 ? (
          <p className={styles.empty}>
            {isSearching ? "No matching entities." : "No entities yet."}
          </p>
        ) : null}

        {isSearching ? (
          <ul className={styles.rows}>
            {entityMatches.map((entity) => (
              <li key={entity.id}>
                <button
                  type="button"
                  className={styles.row}
                  onClick={() => openEntity(entity)}
                >
                  {entity.name}
                  <span className={styles.rowMeta}>{entity.type}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          groupByType(entityMatches).map(([type, rows]) => {
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
                        ? styles.chevron
                        : `${styles.chevron} ${styles.chevronOpen}`
                    }
                    aria-hidden="true"
                  />
                  {type} · {rows.length}
                </button>
                {isCollapsed ? null : (
                  <ul className={styles.rows}>
                    {rows.map((entity) => (
                      <li key={entity.id}>
                        <button
                          type="button"
                          className={styles.row}
                          onClick={() => openEntity(entity)}
                        >
                          {entity.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })
        )}

        {!isSearching && isWriter ? (
          <>
            <p className={styles.sectionLabel}>Create</p>
            <ul className={styles.rows}>
              <li>
                <button
                  type="button"
                  className={styles.row}
                  onClick={() => {
                    openCreateEntityWindow();
                    onClose();
                  }}
                >
                  <Icon icon={Plus} size={14} aria-hidden="true" />
                  New Entity
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className={styles.row}
                  onClick={() => {
                    openCreateNoteWindow();
                    onClose();
                  }}
                >
                  <Icon icon={Plus} size={14} aria-hidden="true" />
                  New Note
                </button>
              </li>
            </ul>
          </>
        ) : null}

        {!isSearching ? (
          <>
            <p className={styles.sectionLabel}>Layouts</p>
            <ul className={styles.rows}>
              {presetNames.map((name) => (
                <li key={name}>
                  <button
                    type="button"
                    className={styles.row}
                    onClick={() => {
                      applyPreset(name);
                      onClose();
                    }}
                  >
                    <Icon icon={LayoutGrid} size={14} aria-hidden="true" />
                    {name}
                  </button>
                </li>
              ))}
              <li>
                <button
                  type="button"
                  className={styles.row}
                  onClick={handleSavePreset}
                >
                  <Icon icon={Save} size={14} aria-hidden="true" />
                  Save current layout…
                </button>
              </li>
            </ul>
          </>
        ) : null}
      </div>

      <div className={styles.footer}>
        <span className={styles.who}>{userEmail ?? "Signed in"}</span>
        <Link as={RouterLink} to="/dashboard">
          <Icon icon={ArrowLeft} size={14} aria-hidden="true" />
          Dashboard
        </Link>
      </div>
    </div>
  );
}
