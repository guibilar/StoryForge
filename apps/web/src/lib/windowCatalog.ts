import { createElement } from "react";
import type { ReactNode } from "react";

import { ComingSoonPanel } from "../components/ComingSoonPanel";
import { MembersWindow } from "../components/MembersWindow";
import { NotesWindow } from "../components/NotesWindow";
import { NpcsWindow } from "../components/NpcsWindow";
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

// Data-driven so KAN-39/81/84/49/85 can each replace their entry's `render`
// with a real component without touching the desktop shell.
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
    render: () => createElement(ComingSoonPanel, { ticket: "KAN-84" }),
  },
  {
    id: "timeline",
    title: "Timeline",
    render: () => createElement(ComingSoonPanel, { ticket: "KAN-49" }),
  },
  {
    id: "notes",
    title: "Notes",
    render: () => createElement(NotesWindow),
    // KAN-62: Owner + Storyteller full read/write. Player visibility isn't
    // defined until KAN-63 (shared vs. private notes) lands, so Players and
    // Observers don't see this window at all — same pattern as Members.
    visibleToRoles: ["OWNER", "STORYTELLER", "CO_STORYTELLER"],
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
};
