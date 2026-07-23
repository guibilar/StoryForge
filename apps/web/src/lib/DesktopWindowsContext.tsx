import { createContext, useContext } from "react";
import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";

import type { ArrangeMode, LayoutMap } from "../hooks/useDesktopLayout";
import type { BoardSize, SnapZone } from "./windowSnap";

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
// useDesktopWindowsController) and shared with <DesktopBoard> (which renders
// windows), <Taskbar> and <StartMenu> (which open, raise and minimize them)
// — they're siblings, not ancestor/descendant, so this has to be a context
// rather than DesktopBoard-local state.
export interface DesktopWindowsApi {
  layout: LayoutMap;
  bringToFront: (id: string) => void;
  toggle: (id: string) => void;
  // Window states the taskbar and window chrome drive. `minimize` is open
  // but not drawn (distinct from `toggle`, which closes); the board's own
  // size is passed in for the ones that need it, since only the board knows
  // how big it currently is.
  minimize: (id: string) => void;
  restoreWindow: (id: string) => void;
  toggleMaximize: (id: string, board: BoardSize) => void;
  snapWindow: (id: string, zone: SnapZone, board: BoardSize) => void;
  arrange: (mode: ArrangeMode, board: BoardSize) => void;
  showDesktop: () => void;
  startDrag: (
    id: string,
    event: ReactPointerEvent,
    boardEl: HTMLElement,
    windowEl: HTMLElement,
    onSnapZoneChange?: (zone: SnapZone | null) => void,
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
// content, or a sibling like the start menu) open a window for an id chosen
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
