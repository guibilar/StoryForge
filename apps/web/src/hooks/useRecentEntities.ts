import { useCallback, useState } from "react";

import { markLocalWorkspaceWrite } from "../lib/workspaceClock";

const MAX_RECENTS = 10;

function storageKey(campaignId: string): string {
  return `storyforge:recents:${campaignId}`;
}

function loadRecents(campaignId: string): string[] {
  try {
    const raw = localStorage.getItem(storageKey(campaignId));
    if (!raw) {
      return [];
    }
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === "string")
      : [];
  } catch {
    return [];
  }
}

// localStorage-backed, most-recent-first list of entity ids opened in this
// campaign — mirrors useDesktopLayout's per-campaign localStorage precedent.
// KAN-104 layers server sync (KAN-103's myWorkspaceState/saveWorkspaceState)
// on top via hydrateRecents; this hook stays localStorage-only either way,
// so the app still works offline or before the server round-trip lands.
export function useRecentEntities(campaignId: string) {
  const [recentIds, setRecentIds] = useState<string[]>(() =>
    loadRecents(campaignId),
  );

  const recordOpen = useCallback(
    (id: string) => {
      setRecentIds((current) => {
        const next = [
          id,
          ...current.filter((existing) => existing !== id),
        ].slice(0, MAX_RECENTS);
        localStorage.setItem(storageKey(campaignId), JSON.stringify(next));
        markLocalWorkspaceWrite(campaignId);
        return next;
      });
    },
    [campaignId],
  );

  // Overwrites the list wholesale with server-fetched data (KAN-104).
  const hydrateRecents = useCallback(
    (serverRecentIds: string[]) => {
      const next = serverRecentIds.slice(0, MAX_RECENTS);
      localStorage.setItem(storageKey(campaignId), JSON.stringify(next));
      setRecentIds(next);
    },
    [campaignId],
  );

  return { recentIds, recordOpen, hydrateRecents };
}
