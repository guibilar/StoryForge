import { useEffect, useMemo, useState } from "react";
import { useQuery } from "urql";
import { CommandPalette } from "@storyforge/ui";
import type { CommandPaletteSection } from "@storyforge/ui";

import {
  EntitiesDocument,
  NotesDocument,
  SessionsDocument,
} from "../gql/graphql";
import type { CampaignRole } from "../gql/graphql";
import { useDesktopWindows } from "../lib/DesktopWindowsContext";
import { useOpenEntityWindow } from "../hooks/useOpenEntityWindow";
import { scoreMatch } from "../lib/commandScore";
import { CreateEntityModal } from "./CreateEntityModal";
import { CreateNoteModal } from "./CreateNoteModal";
import type { EntitySummary } from "./EntityWindow";

export interface AppCommandPaletteProps {
  campaignId: string;
  role?: CampaignRole;
}

const MAX_RESULTS_PER_SECTION = 8;

interface ScoredItem<T> {
  score: number;
  value: T;
  id: string;
  label: string;
  sublabel?: string;
}

function rank<T>(
  query: string,
  values: T[],
  toSearchable: (value: T) => { id: string; label: string; sublabel?: string },
): ScoredItem<T>[] {
  return values
    .map((value) => {
      const { id, label, sublabel } = toSearchable(value);
      const score = Math.max(
        scoreMatch(query, label),
        sublabel ? scoreMatch(query, sublabel) - 5 : -1,
      );
      return { score, value, id, label, sublabel };
    })
    .filter((item) => item.score >= 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RESULTS_PER_SECTION);
}

function previewOf(content: string): string {
  const flat = content.replace(/\s+/g, " ").trim();
  return flat.length > 80 ? `${flat.slice(0, 80)}…` : flat;
}

// Global ⌘K/Ctrl+K palette. Mounted once per campaign (inside
// DesktopWindowsContext.Provider, which CampaignDesktopPage owns) — works
// the same on mobile and desktop since it's a full-screen overlay, not part
// of the sidebar+board layout.
export function AppCommandPalette({
  campaignId,
  role,
}: AppCommandPaletteProps) {
  const { toggle } = useDesktopWindows();
  const openEntityWindow = useOpenEntityWindow(campaignId);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [quickAction, setQuickAction] = useState<"entity" | "note" | null>(
    null,
  );

  const [{ data: entitiesData }, reexecuteEntities] = useQuery({
    query: EntitiesDocument,
    variables: { campaignId },
    pause: !open,
  });
  const [{ data: notesData }] = useQuery({
    query: NotesDocument,
    variables: { campaignId },
    pause: !open,
  });
  const [{ data: sessionsData }] = useQuery({
    query: SessionsDocument,
    variables: { campaignId },
    pause: !open,
  });

  const entities: EntitySummary[] = useMemo(
    () => entitiesData?.entities ?? [],
    [entitiesData],
  );
  const notes = useMemo(() => notesData?.noteRoots ?? [], [notesData]);
  const sessions = useMemo(() => sessionsData?.sessions ?? [], [sessionsData]);

  const isWriter =
    role === "OWNER" || role === "STORYTELLER" || role === "CO_STORYTELLER";

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  function closePalette() {
    setOpen(false);
    setQuery("");
    setActiveId(null);
  }

  const entityMatches = useMemo(
    () =>
      rank(query, entities, (entity) => ({
        id: `entity:${entity.id}`,
        label: entity.name,
        sublabel: entity.type,
      })),
    [query, entities],
  );
  const noteMatches = useMemo(
    () =>
      rank(query, notes, (note) => ({
        id: `note:${note.id}`,
        label: note.title,
        sublabel: previewOf(note.content),
      })),
    [query, notes],
  );
  const sessionMatches = useMemo(
    () =>
      rank(query, sessions, (session) => ({
        id: `session:${session.id}`,
        label: `Session ${session.sessionNumber}`,
        sublabel: session.summary ? previewOf(session.summary) : session.date,
      })),
    [query, sessions],
  );
  const actionItems = useMemo(() => {
    const actions = [
      {
        id: "action:new-entity",
        label: "New Entity",
        sublabel: "Create a new entity",
      },
      {
        id: "action:new-note",
        label: "New Note",
        sublabel: "Create a new note",
      },
    ];
    if (!isWriter) {
      return [];
    }
    return actions
      .map((action) => ({
        ...action,
        score: Math.max(scoreMatch(query, action.label), 0),
      }))
      .filter((action) => action.score >= 0);
  }, [query, isWriter]);

  const sections: CommandPaletteSection[] = [
    {
      label: "Actions",
      items: actionItems.map(({ id, label, sublabel }) => ({
        id,
        label,
        sublabel,
      })),
    },
    {
      label: "Entities",
      items: entityMatches.map(({ id, label, sublabel }) => ({
        id,
        label,
        sublabel,
      })),
    },
    {
      label: "Notes",
      items: noteMatches.map(({ id, label, sublabel }) => ({
        id,
        label,
        sublabel,
      })),
    },
    {
      label: "Sessions",
      items: sessionMatches.map(({ id, label, sublabel }) => ({
        id,
        label,
        sublabel,
      })),
    },
  ].filter((section) => section.items.length > 0);

  function handleCommit(id: string) {
    const separatorIndex = id.indexOf(":");
    const kind = id.slice(0, separatorIndex);
    const value = id.slice(separatorIndex + 1);

    if (kind === "entity") {
      const entity = entities.find((candidate) => candidate.id === value);
      if (entity) {
        openEntityWindow(entity);
      }
    } else if (kind === "note") {
      toggle("notes");
    } else if (kind === "session") {
      toggle("sessions");
    } else if (kind === "action" && value === "new-entity") {
      setQuickAction("entity");
    } else if (kind === "action" && value === "new-note") {
      setQuickAction("note");
    }

    closePalette();
  }

  return (
    <>
      <CommandPalette
        open={open}
        query={query}
        onQueryChange={setQuery}
        sections={sections}
        activeId={activeId}
        onActiveChange={setActiveId}
        onCommit={handleCommit}
        onClose={closePalette}
      />
      <CreateEntityModal
        open={quickAction === "entity"}
        campaignId={campaignId}
        onClose={() => setQuickAction(null)}
        onCreated={() => reexecuteEntities({ requestPolicy: "network-only" })}
      />
      <CreateNoteModal
        open={quickAction === "note"}
        campaignId={campaignId}
        onClose={() => setQuickAction(null)}
      />
    </>
  );
}
