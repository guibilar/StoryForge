import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import { useDesktopLayout } from "./useDesktopLayout";
import type { LayoutMap } from "./useDesktopLayout";
import { useRecentEntities } from "./useRecentEntities";
import { DEFAULT_LAYOUT } from "../lib/windowCatalog";
import {
  isDynamicWindowId,
  isRestorableWindowId,
  renderRestoredWindow,
} from "../lib/dynamicWindowRegistry";
import type { OpenWindowRequest } from "../lib/DesktopWindowsContext";

interface DynamicWindowEntry {
  title: string;
  render: () => ReactNode;
}

const ENTITY_ID_PREFIX = "entity:";

function titlesKey(campaignId: string): string {
  return `storyforge:desktop:${campaignId}:dynamic`;
}

// Only the titles need persisting: the geometry already lives in the layout
// and the content is rebuilt from the id by the registry.
function loadDynamicTitles(campaignId: string): Record<string, string> {
  try {
    const raw = localStorage.getItem(titlesKey(campaignId));
    if (!raw) {
      return {};
    }
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) {
      return {};
    }
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).filter(
        (pair): pair is [string, string] => typeof pair[1] === "string",
      ),
    );
  } catch {
    return {};
  }
}

function saveDynamicTitles(
  campaignId: string,
  entries: Record<string, DynamicWindowEntry>,
): void {
  const titles = Object.fromEntries(
    Object.entries(entries)
      .filter(([id]) => isRestorableWindowId(id))
      .map(([id, entry]) => [id, entry.title]),
  );
  try {
    localStorage.setItem(titlesKey(campaignId), JSON.stringify(titles));
  } catch {
    // Storage full or blocked — restoring after a reload is a nicety, not
    // worth failing the open for.
  }
}

// Rebuilds the render functions for windows that were open when the tab was
// last closed. Titles come from localStorage; content comes from the id.
function restoreDynamicWindows(
  campaignId: string,
): Record<string, DynamicWindowEntry> {
  if (!campaignId) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(loadDynamicTitles(campaignId))
      .filter(([id]) => isRestorableWindowId(id))
      .map(([id, title]) => [
        id,
        { title, render: () => renderRestoredWindow(id, campaignId) },
      ]),
  );
}

// Single source of truth for "what windows are open on this campaign's
// desktop" — owned once by CampaignDesktopPage and shared, via
// DesktopWindowsContext, by both <DesktopBoard> (renders them) and
// <EntitySidebar> (opens them). Kept out of DesktopBoard itself because a
// sibling component needs the same state, not just a descendant.
export function useDesktopWindowsController(campaignId: string) {
  const layoutApi = useDesktopLayout(campaignId, DEFAULT_LAYOUT);
  const {
    openWindow: layoutOpenWindow,
    closeWindow: layoutCloseWindow,
    hydrateLayout,
  } = layoutApi;

  // useDesktopLayout only tracks position/size/z/hidden for a dynamic id;
  // the title + content to render for it lives here, since a React render
  // function can't be persisted to localStorage.
  const [dynamicWindows, setDynamicWindows] = useState<
    Record<string, DynamicWindowEntry>
  >(() => restoreDynamicWindows(campaignId));

  const { recentIds, recordOpen, hydrateRecents } =
    useRecentEntities(campaignId);

  // Combines both underlying hydrate calls behind one entry point for
  // KAN-104's server-sync hook, so it doesn't need to know these are two
  // separate localStorage-backed pieces of state under the hood.
  const hydrateFromServer = useCallback(
    (serverLayout: LayoutMap, serverRecentIds: string[]) => {
      hydrateLayout(serverLayout);
      hydrateRecents(serverRecentIds);
    },
    [hydrateLayout, hydrateRecents],
  );

  const openWindow = useCallback(
    (request: OpenWindowRequest) => {
      setDynamicWindows((current) => {
        const next = {
          ...current,
          [request.id]: { title: request.title, render: request.render },
        };
        saveDynamicTitles(campaignId, next);
        return next;
      });
      layoutOpenWindow(request.id, {
        x: request.x,
        y: request.y,
        width: request.width,
        height: request.height,
      });
      // recentIds tracks entity ids specifically, so only record those —
      // not note:{id} or the form windows that open through this same path.
      if (request.id.startsWith(ENTITY_ID_PREFIX)) {
        recordOpen(request.id.slice(ENTITY_ID_PREFIX.length));
      }
    },
    [campaignId, layoutOpenWindow, recordOpen],
  );

  const closeWindow = useCallback(
    (id: string) => {
      layoutCloseWindow(id);
      setDynamicWindows((current) => {
        const rest = { ...current };
        delete rest[id];
        saveDynamicTitles(campaignId, rest);
        return rest;
      });
    },
    [campaignId, layoutCloseWindow],
  );

  // A window whose content can't be rebuilt (the *-form ones, which would
  // come back as empty drafts) leaves a layout entry behind that nothing
  // will ever render. Dropped once on mount so they don't accumulate in
  // localStorage — and in the saved workspace state — forever.
  const prunedRef = useRef(false);
  useEffect(() => {
    if (prunedRef.current || !campaignId) {
      return;
    }
    prunedRef.current = true;

    for (const id of Object.keys(layoutApi.layout)) {
      if (isDynamicWindowId(id) && !isRestorableWindowId(id)) {
        layoutCloseWindow(id);
      }
    }
    // Deliberately mount-only: re-running as the layout changes would fight
    // a form window the user has open right now.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId]);

  return {
    ...layoutApi,
    dynamicWindows,
    openWindow,
    closeWindow,
    recentIds,
    hydrateFromServer,
  };
}
