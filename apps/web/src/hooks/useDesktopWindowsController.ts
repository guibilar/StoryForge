import { useCallback, useState } from "react";
import type { ReactNode } from "react";

import { useDesktopLayout } from "./useDesktopLayout";
import { useRecentEntities } from "./useRecentEntities";
import { DEFAULT_LAYOUT } from "../lib/windowCatalog";
import type { OpenWindowRequest } from "../lib/DesktopWindowsContext";

interface DynamicWindowEntry {
  title: string;
  render: () => ReactNode;
}

const ENTITY_ID_PREFIX = "entity:";

// Single source of truth for "what windows are open on this campaign's
// desktop" — owned once by CampaignDesktopPage and shared, via
// DesktopWindowsContext, by both <DesktopBoard> (renders them) and
// <EntitySidebar> (opens them). Kept out of DesktopBoard itself because a
// sibling component needs the same state, not just a descendant.
export function useDesktopWindowsController(campaignId: string) {
  const layoutApi = useDesktopLayout(campaignId, DEFAULT_LAYOUT);
  const { openWindow: layoutOpenWindow, closeWindow: layoutCloseWindow } =
    layoutApi;

  // useDesktopLayout only tracks position/size/z/hidden for a dynamic id;
  // the title + content to render for it lives here, since a React render
  // function can't be persisted to localStorage.
  const [dynamicWindows, setDynamicWindows] = useState<
    Record<string, DynamicWindowEntry>
  >({});

  const { recentIds, recordOpen } = useRecentEntities(campaignId);

  const openWindow = useCallback(
    (request: OpenWindowRequest) => {
      setDynamicWindows((current) => ({
        ...current,
        [request.id]: { title: request.title, render: request.render },
      }));
      layoutOpenWindow(request.id, {
        x: request.x,
        y: request.y,
        width: request.width,
        height: request.height,
      });
      // Every dynamic window opened today is an entity:{id} one — recentIds
      // tracks entity ids specifically, so only record those, not some
      // future non-entity dynamic window type opened through the same path.
      if (request.id.startsWith(ENTITY_ID_PREFIX)) {
        recordOpen(request.id.slice(ENTITY_ID_PREFIX.length));
      }
    },
    [layoutOpenWindow, recordOpen],
  );

  const closeWindow = useCallback(
    (id: string) => {
      layoutCloseWindow(id);
      setDynamicWindows((current) => {
        const rest = { ...current };
        delete rest[id];
        return rest;
      });
    },
    [layoutCloseWindow],
  );

  return {
    ...layoutApi,
    dynamicWindows,
    openWindow,
    closeWindow,
    recentIds,
  };
}
