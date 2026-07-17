import { useCallback, useState } from "react";

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
// campaign — mirrors useDesktopLayout's per-campaign localStorage precedent
// rather than a backend model (see KAN-103 for the optional server-synced
// upgrade path, deliberately not built yet).
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
        return next;
      });
    },
    [campaignId],
  );

  return { recentIds, recordOpen };
}
