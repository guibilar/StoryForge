import { createElement } from "react";
import type { ReactNode } from "react";

import { MembersWindow } from "../components/MembersWindow";
import { NotesWindow } from "../components/NotesWindow";
import { NpcsWindow } from "../components/NpcsWindow";
import { RelationshipGraphWindow } from "../components/RelationshipGraphWindow";
import { SessionsWindow } from "../components/SessionsWindow";
import { TimelineWindow } from "../components/TimelineWindow";
import type { LayoutMap } from "../hooks/useDesktopLayout";
import type { CampaignRole } from "../gql/graphql";

export interface WindowCatalogEntry {
  id: string;
  title: string;
  render: () => ReactNode;
  // When set, the window is hidden from the dock/board for any viewer whose
  // role isn't in this list. Undefined means visible to every campaign member.
  visibleToRoles?: CampaignRole[];
}

// Data-driven so future windows (Relationships, Maps, ...) can plug in by
// adding a catalog entry, without touching the desktop shell.
export const WINDOW_CATALOG: WindowCatalogEntry[] = [
  {
    id: "npcs",
    title: "NPCs",
    render: () => createElement(NpcsWindow),
  },
  {
    id: "members",
    title: "Members",
    render: () => createElement(MembersWindow),
    // Owner: full CRUD. Storyteller/Co-Storyteller: read-only. Player
    // visibility is an open question per KAN-81/KAN-62, so Players (and
    // Observers) don't see this window at all.
    visibleToRoles: ["OWNER", "STORYTELLER", "CO_STORYTELLER"],
  },
  {
    id: "sessions",
    title: "Sessions",
    render: () => createElement(SessionsWindow),
  },
  {
    id: "timeline",
    title: "Timeline",
    render: () => createElement(TimelineWindow),
  },
  {
    id: "notes",
    title: "Notes",
    render: () => createElement(NotesWindow),
    // Visible to every member since KAN-63: the API filters what each role
    // can read (shared notes, plus targeted handouts addressed to you).
  },
  {
    id: "relationships",
    title: "Relationship Graph",
    render: () => createElement(RelationshipGraphWindow),
    // View-only for v1 (no create/edit UI), so every role can see it.
  },
];

export function visibleWindowCatalog(
  role: CampaignRole | undefined,
): WindowCatalogEntry[] {
  return WINDOW_CATALOG.filter(
    (entry) =>
      !entry.visibleToRoles || (role && entry.visibleToRoles.includes(role)),
  );
}

export const DEFAULT_LAYOUT: LayoutMap = {
  npcs: { x: 28, y: 24, width: 310, height: 280, hidden: false, z: 2 },
  members: { x: 356, y: 24, width: 380, height: 320, hidden: false, z: 3 },
  sessions: { x: 754, y: 24, width: 398, height: 340, hidden: false, z: 2 },
  timeline: { x: 28, y: 322, width: 480, height: 260, hidden: true, z: 1 },
  notes: { x: 526, y: 362, width: 360, height: 240, hidden: true, z: 1 },
  relationships: {
    x: 130,
    y: 60,
    width: 520,
    height: 420,
    hidden: true,
    z: 1,
  },
};
