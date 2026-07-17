import { createContext, useContext } from "react";
import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";

import type { LayoutMap } from "../hooks/useDesktopLayout";

export interface OpenWindowRequest {
  id: string;
  title: string;
  render: () => ReactNode;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DynamicWindowEntry {
  title: string;
  render: () => ReactNode;
}

// The full "desktop windows" state, owned once by CampaignDesktopPage (via
// useDesktopWindowsController) and shared with both <DesktopBoard> (which
// renders windows) and <EntitySidebar> (which opens/toggles them) — they're
// siblings, not ancestor/descendant, so this has to be a context rather than
// DesktopBoard-local state.
export interface DesktopWindowsApi {
  layout: LayoutMap;
  bringToFront: (id: string) => void;
  toggle: (id: string) => void;
  startDrag: (
    id: string,
    event: ReactPointerEvent,
    boardEl: HTMLElement,
    windowEl: HTMLElement,
  ) => void;
  startResize: (
    id: string,
    event: ReactPointerEvent,
    boardEl: HTMLElement,
    windowEl: HTMLElement,
  ) => void;
  reset: () => void;
  dynamicWindows: Record<string, DynamicWindowEntry>;
  openWindow: (request: OpenWindowRequest) => void;
  closeWindow: (id: string) => void;
  // Most-recent-first entity ids opened via openWindow, capped at 10 — see
  // useRecentEntities.ts. Raw entity ids, not entity:{id} window ids.
  recentIds: string[];
  // Named, saved LayoutMap snapshots — see useDesktopLayout's savePreset for
  // the caveat on dynamic (entity:*) windows.
  presets: Record<string, LayoutMap>;
  savePreset: (name: string) => void;
  applyPreset: (name: string) => void;
  // Overwrites layout + recentIds wholesale from server-fetched data
  // (KAN-104's useWorkspaceStateSync) — the frontend counterpart to KAN-103's
  // myWorkspaceState/saveWorkspaceState.
  hydrateFromServer: (layout: LayoutMap, recentEntityIds: string[]) => void;
}

export const DesktopWindowsContext = createContext<DesktopWindowsApi | null>(
  null,
);

// Lets any component under the provider (DesktopBoard, its catalog window
// content, or a sibling like EntitySidebar) open a window for an id chosen
// at runtime, not just the static windowCatalog entries.
export function useDesktopWindows(): DesktopWindowsApi {
  const ctx = useContext(DesktopWindowsContext);
  if (!ctx) {
    throw new Error(
      "useDesktopWindows must be used within a DesktopWindowsContext.Provider",
    );
  }
  return ctx;
}
