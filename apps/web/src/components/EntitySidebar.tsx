import type { FormEvent } from "react";
import { useState } from "react";
import { useMutation, useQuery } from "urql";
import {
  Button,
  Form,
  FormError,
  FormField,
  Input,
  Modal,
  Select,
  Textarea,
} from "@storyforge/ui";

import {
  CreateEntityDocument,
  CreateNoteDocument,
  EntitiesDocument,
} from "../gql/graphql";
import type { CampaignRole, EntityVisibility } from "../gql/graphql";
import { useDesktopWindows } from "../lib/DesktopWindowsContext";
import { formatGraphQLError } from "../lib/graphqlError";
import { EntityWindow } from "./EntityWindow";
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

const VISIBILITIES: EntityVisibility[] = ["PUBLIC", "STORYTELLER", "PRIVATE"];
const DEFAULT_ENTITY_WINDOW = { width: 380, height: 420 };

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
  const { layout, toggle, openWindow, dynamicWindows } = useDesktopWindows();

  const [{ data, fetching, error }, reexecuteEntities] = useQuery({
    query: EntitiesDocument,
    variables: { campaignId },
  });

  const [createEntityState, createEntity] = useMutation(CreateEntityDocument);
  const [createNoteState, createNote] = useMutation(CreateNoteDocument);

  const [quickAction, setQuickAction] = useState<QuickAction>(null);

  const isWriter =
    role === "OWNER" || role === "STORYTELLER" || role === "CO_STORYTELLER";
  const entities: EntitySummary[] = data?.entities ?? [];
  const groups = groupByType(entities);

  function openEntityWindow(entity: EntitySummary) {
    // A cascade offset so opening several entity windows in a row doesn't
    // stack them exactly on top of each other. openWindow itself restores
    // the saved position instead of this default if the window was already
    // opened (and possibly moved) before, so this only matters the first time.
    const offset = (Object.keys(dynamicWindows).length % 6) * 24;
    openWindow({
      id: `entity:${entity.id}`,
      title: entity.name,
      render: () => <EntityWindow entity={entity} />,
      x: 140 + offset,
      y: 80 + offset,
      width: DEFAULT_ENTITY_WINDOW.width,
      height: DEFAULT_ENTITY_WINDOW.height,
    });
  }

  function closeQuickAction() {
    setQuickAction(null);
  }

  async function handleCreateEntity(event: FormEvent<HTMLFormElement>) {
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
        name,
        description: description || null,
        visibility,
      },
    });
    if (result.data?.createEntity) {
      closeQuickAction();
      reexecuteEntities({ requestPolicy: "network-only" });
    }
  }

  async function handleCreateNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const title = String(form.get("title") ?? "").trim();
    const content = String(form.get("content") ?? "").trim();

    if (!title) {
      return;
    }

    // Kept deliberately minimal (title + content only, visibility fixed to
    // SHARED) — a quick way to stub a note. Refine it via the Notes window,
    // which has the full editor/visibility/recipients UI.
    const result = await createNote({
      input: {
        campaignId,
        title,
        content: content || null,
        visibility: "SHARED",
      },
    });
    if (result.data?.createNote) {
      closeQuickAction();
      toggle("notes");
    }
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

      <Modal open={quickAction === "entity"} onClose={closeQuickAction}>
        <h2>New Entity</h2>
        <Form onSubmit={handleCreateEntity}>
          <FormError>{formatGraphQLError(createEntityState.error)}</FormError>
          <FormField label="Name" htmlFor="sidebar-entity-name">
            <Input id="sidebar-entity-name" name="name" required />
          </FormField>
          <FormField label="Type" htmlFor="sidebar-entity-type">
            <Input
              id="sidebar-entity-type"
              name="type"
              placeholder="e.g. Character, Location, Item"
              required
            />
          </FormField>
          <FormField label="Description" htmlFor="sidebar-entity-description">
            <Textarea
              id="sidebar-entity-description"
              name="description"
              rows={3}
            />
          </FormField>
          <FormField label="Visibility" htmlFor="sidebar-entity-visibility">
            <Select
              id="sidebar-entity-visibility"
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
          <div className={styles.modalActions}>
            <Button
              type="button"
              variant="secondary"
              onClick={closeQuickAction}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createEntityState.fetching}>
              Create
            </Button>
          </div>
        </Form>
      </Modal>

      <Modal open={quickAction === "note"} onClose={closeQuickAction}>
        <h2>New Note</h2>
        <Form onSubmit={handleCreateNote}>
          <FormError>{formatGraphQLError(createNoteState.error)}</FormError>
          <FormField label="Title" htmlFor="sidebar-note-title">
            <Input id="sidebar-note-title" name="title" required />
          </FormField>
          <FormField label="Content" htmlFor="sidebar-note-content">
            <Textarea id="sidebar-note-content" name="content" rows={5} />
          </FormField>
          <div className={styles.modalActions}>
            <Button
              type="button"
              variant="secondary"
              onClick={closeQuickAction}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createNoteState.fetching}>
              Create
            </Button>
          </div>
        </Form>
      </Modal>
    </nav>
  );
}
