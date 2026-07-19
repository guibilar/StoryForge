import { useCallback, useEffect, useRef } from "react";
import { useMutation, useQuery } from "urql";

import {
  MyWorkspaceStateDocument,
  SaveWorkspaceStateDocument,
} from "../gql/graphql";
import { readLocalWorkspaceWrite } from "../lib/workspaceClock";
import type { LayoutMap } from "./useDesktopLayout";

const SAVE_DEBOUNCE_MS = 1500;

export interface WorkspaceStateSyncTarget {
  layout: LayoutMap;
  recentIds: string[];
  hydrateFromServer: (layout: LayoutMap, recentEntityIds: string[]) => void;
}

// The frontend half of KAN-103: on mount, load whatever this user last
// saved for this campaign (if anything) and hydrate the local
// (localStorage-backed) desktop-windows state with it; after that, debounce
// and push local changes back up. Deliberately fail-open — a network error,
// a not-yet-deployed backend, or a malformed payload all just leave the app
// running on localStorage alone, exactly as it did before this existed.
// Takes its target as a plain object rather than reading useDesktopWindows()
// itself so it can be called directly from CampaignDesktopPage, which
// already holds the same controller instance it's about to hand to the
// context provider — no need to round-trip through context to read it back.
export function useWorkspaceStateSync(
  campaignId: string,
  { layout, recentIds, hydrateFromServer }: WorkspaceStateSyncTarget,
) {
  const [{ data, fetching, error }] = useQuery({
    query: MyWorkspaceStateDocument,
    variables: { campaignId },
    pause: !campaignId,
  });
  const [, saveWorkspaceState] = useMutation(SaveWorkspaceStateDocument);

  // Flips true once the initial load has settled (with or without data) —
  // gates the save effect below so it can't fire before there's been a
  // chance to hydrate from whatever the server already has.
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    if (hasLoadedRef.current || fetching || !campaignId) {
      return;
    }
    hasLoadedRef.current = true;

    if (error || !data?.myWorkspaceState) {
      return;
    }

    // Hydration overwrites localStorage wholesale, so a snapshot older than
    // this browser's own last write would roll the user back — losing, for
    // instance, a window they opened seconds before reloading, whose
    // debounced save hadn't been pushed up yet. Server wins only when it is
    // genuinely newer (a change made in another tab or on another device).
    const serverUpdatedAt = Date.parse(data.myWorkspaceState.updatedAt);
    const localUpdatedAt = readLocalWorkspaceWrite(campaignId);
    if (
      localUpdatedAt !== null &&
      Number.isFinite(serverUpdatedAt) &&
      localUpdatedAt > serverUpdatedAt
    ) {
      return;
    }

    try {
      const serverLayout = JSON.parse(
        data.myWorkspaceState.layout,
      ) as LayoutMap;
      const serverRecentIds = JSON.parse(
        data.myWorkspaceState.recentEntityIds,
      ) as string[];
      hydrateFromServer(serverLayout, serverRecentIds);
    } catch {
      // Malformed server payload — keep whatever's already loaded from
      // localStorage rather than clobber a working local state with garbage.
    }
  }, [campaignId, data, error, fetching, hydrateFromServer]);

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  // Whether a debounced save is still owed, plus the values it would send.
  // Held in refs so flush() can fire on the way out without being rebuilt
  // (and re-registered as a listener) on every layout change.
  const pendingRef = useRef(false);
  const latestRef = useRef({ layout, recentIds });
  useEffect(() => {
    latestRef.current = { layout, recentIds };
  }, [layout, recentIds]);

  const flush = useCallback(() => {
    if (!pendingRef.current || !campaignId) {
      return;
    }
    pendingRef.current = false;
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    void saveWorkspaceState({
      input: {
        campaignId,
        layout: JSON.stringify(latestRef.current.layout),
        recentEntityIds: JSON.stringify(latestRef.current.recentIds),
      },
    });
  }, [campaignId, saveWorkspaceState]);

  useEffect(() => {
    if (!hasLoadedRef.current || !campaignId) {
      return;
    }

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    pendingRef.current = true;
    saveTimeoutRef.current = setTimeout(() => {
      pendingRef.current = false;
      void saveWorkspaceState({
        input: {
          campaignId,
          layout: JSON.stringify(layout),
          recentEntityIds: JSON.stringify(recentIds),
        },
      });
    }, SAVE_DEBOUNCE_MS);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [campaignId, layout, recentIds, saveWorkspaceState]);

  // A reload lands inside the debounce window almost every time — open a
  // window, hit refresh, and the pending save would otherwise be cancelled
  // by the cleanup above and never sent. Declared after that effect so its
  // cleanup runs second: the timer is cleared, then this sends the save the
  // timer never got to.
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") {
        flush();
      }
    }

    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      flush();
    };
  }, [flush]);
}
