import { createElement } from "react";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  CalendarDays,
  Clock,
  Map as MapIcon,
  Network,
  StickyNote,
  Users,
} from "lucide-react";

import { MapsWindow } from "../components/MapsWindow";
import { MembersWindow } from "../components/MembersWindow";
import { NotesWindow } from "../components/NotesWindow";
import { RelationshipGraphWindow } from "../components/RelationshipGraphWindow";
import { SessionsWindow } from "../components/SessionsWindow";
import { TimelineWindow } from "../components/TimelineWindow";
import type { LayoutMap } from "../hooks/useDesktopLayout";
import type { CampaignRole } from "../gql/graphql";

export interface WindowCatalogEntry {
  id: string;
  title: string;
  // Drawn wherever this window is offered: desktop icon, taskbar button,
  // start-menu tile. Lives on the catalog entry so those three surfaces
  // can't drift apart the way the old sidebar's own WORLD_NAV list did.
  icon: LucideIcon;
  render: () => ReactNode;
  // When set, the window is hidden from the dock/board for any viewer whose
  // role isn't in this list. Undefined means visible to every campaign member.
  visibleToRoles?: CampaignRole[];
}

// Data-driven so future windows can plug in by adding a catalog entry,
// without touching the desktop shell.
export const WINDOW_CATALOG: WindowCatalogEntry[] = [
  {
    id: "members",
    icon: Users,
    title: "Members",
    render: () => createElement(MembersWindow),
    // Owner: full CRUD. Storyteller/Co-Storyteller: read-only. Player
    // visibility is an open question per KAN-81/KAN-62, so Players (and
    // Observers) don't see this window at all.
    visibleToRoles: ["OWNER", "STORYTELLER", "CO_STORYTELLER"],
  },
  {
    id: "sessions",
    icon: CalendarDays,
    title: "Sessions",
    render: () => createElement(SessionsWindow),
  },
  {
    id: "timeline",
    icon: Clock,
    title: "Timeline",
    render: () => createElement(TimelineWindow),
  },
  {
    id: "notes",
    icon: StickyNote,
    title: "Notes",
    render: () => createElement(NotesWindow),
    // Visible to every member since KAN-63: the API filters what each role
    // can read (shared notes, plus targeted handouts addressed to you).
  },
  {
    id: "relationships",
    icon: Network,
    title: "Relationship Graph",
    render: () => createElement(RelationshipGraphWindow),
    // View-only for v1 (no create/edit UI), so every role can see it.
  },
  {
    id: "maps",
    icon: MapIcon,
    title: "Maps",
    render: () => createElement(MapsWindow),
    // Markers/territories/the custom map image (KAN-51/52) have no
    // visibility rules of their own yet, so every role can see the window,
    // same as Relationships — write access is still gated per-action inside
    // MapsWindow (isWriter).
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
  maps: {
    x: 180,
    y: 100,
    width: 560,
    height: 440,
    hidden: true,
    z: 1,
  },
};
