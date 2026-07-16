import { createElement } from "react";
import type { ReactNode } from "react";

import { ComingSoonPanel } from "../components/ComingSoonPanel";
import type { LayoutMap } from "../hooks/useDesktopLayout";

export interface WindowCatalogEntry {
  id: string;
  title: string;
  render: () => ReactNode;
}

// Data-driven so KAN-39/81/84/49/85 can each replace their entry's `render`
// with a real component without touching the desktop shell.
export const WINDOW_CATALOG: WindowCatalogEntry[] = [
  {
    id: "npcs",
    title: "NPCs",
    render: () => createElement(ComingSoonPanel, { ticket: "KAN-39" }),
  },
  {
    id: "members",
    title: "Members",
    render: () => createElement(ComingSoonPanel, { ticket: "KAN-81" }),
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
    render: () => createElement(ComingSoonPanel, { ticket: "KAN-85" }),
  },
];

export const DEFAULT_LAYOUT: LayoutMap = {
  npcs: { x: 28, y: 24, width: 310, height: 280, hidden: false, z: 2 },
  members: { x: 356, y: 24, width: 380, height: 320, hidden: false, z: 3 },
  sessions: { x: 754, y: 24, width: 398, height: 340, hidden: false, z: 2 },
  timeline: { x: 28, y: 322, width: 480, height: 260, hidden: true, z: 1 },
  notes: { x: 526, y: 362, width: 360, height: 240, hidden: true, z: 1 },
};
