import type { ReactNode } from "react";

import { EntityWindowById } from "../components/EntityWindowById";
import { NoteViewWindow } from "../components/NoteViewWindow";

// A dynamic window's title and geometry can be persisted, but its render
// function can't. These rebuild one from its id alone, which is why every
// restorable window type keys on `<prefix>:<id>` and needs nothing else to
// render — a form window, by contrast, carries unsaved draft state that no
// amount of id parsing brings back, so it is deliberately not restorable.
const RESTORERS: {
  prefix: string;
  render: (id: string, campaignId: string) => ReactNode;
}[] = [
  {
    prefix: "entity:",
    render: (id, campaignId) => (
      <EntityWindowById entityId={id} campaignId={campaignId} />
    ),
  },
  {
    prefix: "note:",
    render: (id, campaignId) => (
      <NoteViewWindow noteId={id} campaignId={campaignId} />
    ),
  },
];

export function isRestorableWindowId(windowId: string): boolean {
  return RESTORERS.some((entry) => windowId.startsWith(entry.prefix));
}

// Catalog windows ("timeline", "notes") own their own ids with no colon;
// everything with one was opened at runtime for a specific record.
export function isDynamicWindowId(windowId: string): boolean {
  return windowId.includes(":");
}

export function renderRestoredWindow(
  windowId: string,
  campaignId: string,
): ReactNode | null {
  const restorer = RESTORERS.find((entry) => windowId.startsWith(entry.prefix));

  return restorer
    ? restorer.render(windowId.slice(restorer.prefix.length), campaignId)
    : null;
}
