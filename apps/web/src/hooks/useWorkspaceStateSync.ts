import { useEffect, useRef } from "react";
import { useMutation, useQuery } from "urql";

import {
  MyWorkspaceStateDocument,
  SaveWorkspaceStateDocument,
} from "../gql/graphql";
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

  useEffect(() => {
    if (!hasLoadedRef.current || !campaignId) {
      return;
    }

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
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
}
