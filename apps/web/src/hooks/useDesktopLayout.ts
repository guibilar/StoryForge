import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

import { markLocalWorkspaceWrite } from "../lib/workspaceClock";
import {
  cascadeGeometry,
  geometryForZone,
  restoreGeometry,
  tileGeometry,
  zoneForPointer,
} from "../lib/windowSnap";
import type { BoardSize, SnapZone, WindowGeometry } from "../lib/windowSnap";

export interface WindowLayout {
  x: number;
  y: number;
  width: number;
  height: number;
  // Closed. Catalog windows stay in the layout when closed so reopening them
  // lands where they were; `minimized` below is the different state of being
  // open but not drawn.
  hidden: boolean;
  z: number;
  // Open, but rolled down to the taskbar rather than drawn on the board.
  minimized?: boolean;
  maximized?: boolean;
  // Geometry captured before a maximize/snap, so un-maximizing has somewhere
  // to go back to. All three are optional so a layout persisted before these
  // states existed — in localStorage or in the server's workspace-state JSON
  // — still parses, with `undefined` reading as "not minimized/maximized".
  restore?: WindowGeometry;
}

export type LayoutMap = Record<string, WindowLayout>;

export type ArrangeMode = "tile" | "cascade";

const MIN_WIDTH = 200;
const MIN_HEIGHT = 150;

function storageKey(campaignId: string): string {
  return `storyforge:desktop:${campaignId}`;
}

function presetsKey(campaignId: string): string {
  return `storyforge:desktop:${campaignId}:presets`;
}

function loadLayout(campaignId: string, defaults: LayoutMap): LayoutMap {
  try {
    const raw = localStorage.getItem(storageKey(campaignId));
    if (!raw) {
      return defaults;
    }
    return { ...defaults, ...(JSON.parse(raw) as LayoutMap) };
  } catch {
    return defaults;
  }
}

function loadPresets(campaignId: string): Record<string, LayoutMap> {
  try {
    const raw = localStorage.getItem(presetsKey(campaignId));
    if (!raw) {
      return {};
    }
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, LayoutMap>)
      : {};
  } catch {
    return {};
  }
}

function maxZ(layout: LayoutMap): number {
  return Math.max(0, ...Object.values(layout).map((w) => w.z));
}

function geometryOf(window: WindowLayout): WindowGeometry {
  return {
    x: window.x,
    y: window.y,
    width: window.width,
    height: window.height,
  };
}

// Open and drawn: not closed, not rolled down to the taskbar. The set the
// arrange commands operate on, and what "show desktop" toggles.
export function isOnBoard(window: WindowLayout): boolean {
  return !window.hidden && !window.minimized;
}

export function useDesktopLayout(campaignId: string, defaults: LayoutMap) {
  const [layout, setLayout] = useState<LayoutMap>(() =>
    loadLayout(campaignId, defaults),
  );
  const [presets, setPresets] = useState<Record<string, LayoutMap>>(() =>
    loadPresets(campaignId),
  );

  // Pointer gestures need the current entry (is it maximized? what was its
  // pre-maximize size?) at the moment the gesture starts, without making
  // startDrag depend on `layout` — that would rebuild the callback, and every
  // window's title-bar handler with it, on every drag-end.
  const layoutRef = useRef(layout);
  useEffect(() => {
    layoutRef.current = layout;
  }, [layout]);

  // Writing localStorage inside the setLayout updater (rather than reading a
  // ref afterwards) guarantees the persisted value is the one React actually
  // committed, not a stale snapshot from before the update was scheduled.
  const persistLayout = useCallback(
    (next: LayoutMap) => {
      localStorage.setItem(storageKey(campaignId), JSON.stringify(next));
      // Stamped on every local write so the server sync can tell a snapshot
      // that's genuinely newer from one that would roll this browser back.
      markLocalWorkspaceWrite(campaignId);
      return next;
    },
    [campaignId],
  );

  const bringToFront = useCallback(
    (id: string) => {
      setLayout((current) => {
        // Every pointerdown anywhere inside a window calls this — typing in a
        // field, clicking a list row, starting a drag. Returning `current`
        // unchanged when the window is already on top lets React bail out of
        // the re-render entirely and skips a synchronous JSON.stringify of
        // the whole layout into localStorage on each of those interactions.
        const target = current[id];
        if (!target || target.z === maxZ(current)) {
          return current;
        }
        return persistLayout({
          ...current,
          [id]: { ...target, z: maxZ(current) + 1 },
        });
      });
    },
    [persistLayout],
  );

  // Opens a window for an id chosen at runtime (e.g. `entity:${id}`), not
  // just one predeclared in windowCatalog.ts. If the id is already in the
  // layout (still open, or closed-but-not-removed) it's brought to front at
  // its existing position/size instead of being reset to `defaults`.
  const openWindow = useCallback(
    (
      id: string,
      defaults: { x: number; y: number; width: number; height: number },
    ) => {
      setLayout((current) => {
        const existing = current[id];
        return persistLayout({
          ...current,
          [id]: existing
            ? {
                ...existing,
                hidden: false,
                // Re-opening something that was rolled down to the taskbar
                // should show it, not hand back an invisible window.
                minimized: false,
                z: maxZ(current) + 1,
              }
            : { ...defaults, hidden: false, z: maxZ(current) + 1 },
        });
      });
    },
    [persistLayout],
  );

  // Removes a dynamically-opened window entirely, unlike `toggle` which only
  // hides a static catalog window (so the desktop nav can still reopen it).
  const closeWindow = useCallback(
    (id: string) => {
      setLayout((current) => {
        const rest = { ...current };
        delete rest[id];
        return persistLayout(rest);
      });
    },
    [persistLayout],
  );

  const toggle = useCallback(
    (id: string) => {
      setLayout((current) => {
        const wasHidden = current[id].hidden;
        return persistLayout({
          ...current,
          [id]: {
            ...current[id],
            hidden: !wasHidden,
            // Opening a window that was minimized when it was closed brings
            // it back to the board, not back to the taskbar.
            minimized: wasHidden ? false : current[id].minimized,
            z: wasHidden ? maxZ(current) + 1 : current[id].z,
          },
        });
      });
    },
    [persistLayout],
  );

  const minimize = useCallback(
    (id: string) => {
      setLayout((current) => {
        const target = current[id];
        if (!target || target.minimized) {
          return current;
        }
        return persistLayout({
          ...current,
          [id]: { ...target, minimized: true },
        });
      });
    },
    [persistLayout],
  );

  const restoreWindow = useCallback(
    (id: string) => {
      setLayout((current) => {
        const target = current[id];
        if (!target) {
          return current;
        }
        return persistLayout({
          ...current,
          [id]: {
            ...target,
            minimized: false,
            hidden: false,
            z: maxZ(current) + 1,
          },
        });
      });
    },
    [persistLayout],
  );

  const toggleMaximize = useCallback(
    (id: string, board: BoardSize) => {
      setLayout((current) => {
        const target = current[id];
        if (!target) {
          return current;
        }

        if (target.maximized) {
          const geometry = restoreGeometry(target.restore, board);
          return persistLayout({
            ...current,
            [id]: {
              ...target,
              ...geometry,
              maximized: false,
              restore: undefined,
            },
          });
        }

        return persistLayout({
          ...current,
          [id]: {
            ...target,
            ...geometryForZone("max", board),
            maximized: true,
            restore: geometryOf(target),
            z: maxZ(current) + 1,
          },
        });
      });
    },
    [persistLayout],
  );

  // Applies a drag-to-edge snap. Half-snaps aren't a persistent mode the way
  // maximize is — the window is just moved and resized — but they still
  // capture `restore`, so maximizing a half-snapped window and un-maximizing
  // it returns to the half, not to wherever it was before all of this.
  const snapWindow = useCallback(
    (id: string, zone: SnapZone, board: BoardSize) => {
      setLayout((current) => {
        const target = current[id];
        if (!target) {
          return current;
        }
        return persistLayout({
          ...current,
          [id]: {
            ...target,
            ...geometryForZone(zone, board),
            maximized: zone === "max",
            restore: target.maximized ? target.restore : geometryOf(target),
            z: maxZ(current) + 1,
          },
        });
      });
    },
    [persistLayout],
  );

  const arrange = useCallback(
    (mode: ArrangeMode, board: BoardSize) => {
      setLayout((current) => {
        const ids = Object.entries(current)
          .filter(([, window]) => isOnBoard(window))
          .sort(([, a], [, b]) => a.z - b.z)
          .map(([id]) => id);
        if (ids.length === 0) {
          return current;
        }

        const next = { ...current };
        const base = maxZ(current);
        ids.forEach((id, index) => {
          const geometry =
            mode === "tile"
              ? tileGeometry(index, ids.length, board)
              : cascadeGeometry(index, board);
          next[id] = {
            ...next[id],
            ...geometry,
            maximized: false,
            restore: undefined,
            // Cascade only reads as a stack if the stacking order and the
            // stepping order agree.
            z: base + 1 + index,
          };
        });
        return persistLayout(next);
      });
    },
    [persistLayout],
  );

  // Taskbar "show desktop": rolls everything down, or brings everything back
  // if nothing is on the board. Symmetric rather than remembering which
  // windows this particular click minimized — after a peek, everything that
  // was up is minimized, so restoring all of them is the same set.
  const showDesktop = useCallback(() => {
    setLayout((current) => {
      const anyOnBoard = Object.values(current).some(isOnBoard);
      const next = Object.fromEntries(
        Object.entries(current).map(([id, window]) => [
          id,
          window.hidden ? window : { ...window, minimized: anyOnBoard },
        ]),
      );
      return persistLayout(next);
    });
  }, [persistLayout]);

  // Applies the geometry a whole drag/resize gesture produced in one update.
  // Splitting it out from the state setters is what lets those gestures cost
  // a single React render at the end instead of one per pointermove — see
  // startDrag for why that matters so much here.
  const commitGeometry = useCallback(
    (
      id: string,
      geometry: Partial<WindowGeometry>,
      extra?: Pick<WindowLayout, "maximized" | "restore">,
    ) => {
      setLayout((current) =>
        current[id]
          ? persistLayout({
              ...current,
              [id]: { ...current[id], ...geometry, ...extra },
            })
          : current,
      );
    },
    [persistLayout],
  );

  // "Reset layout" only resets the static catalog windows (the ones present
  // in `defaults`) back to their shipped positions — any dynamically-opened
  // windows (entity:*, etc) are left exactly as they are, since resetting
  // "the layout" isn't the same thing as closing whatever else is open.
  const reset = useCallback(() => {
    setLayout((current) => {
      const dynamicEntries = Object.fromEntries(
        Object.entries(current).filter(([id]) => !(id in defaults)),
      );
      if (Object.keys(dynamicEntries).length === 0) {
        localStorage.removeItem(storageKey(campaignId));
        return defaults;
      }
      return persistLayout({ ...defaults, ...dynamicEntries });
    });
  }, [campaignId, defaults, persistLayout]);

  // Snapshots the *entire current layout* — static catalog windows and any
  // open dynamic (entity:*) windows alike — under a named preset. Only the
  // position data is captured (same limitation as the layout itself): a
  // dynamic window's title/content lives in useDesktopWindowsController, not
  // here, so applying a preset later only re-renders a dynamic window whose
  // content is already registered (i.e. it's currently open) — the position
  // still round-trips either way, it just doesn't resurrect closed windows.
  const savePreset = useCallback(
    (name: string) => {
      setPresets((current) => {
        const next = { ...current, [name]: layout };
        localStorage.setItem(presetsKey(campaignId), JSON.stringify(next));
        return next;
      });
    },
    [campaignId, layout],
  );

  const applyPreset = useCallback(
    (name: string) => {
      setLayout((current) => {
        const preset = presets[name];
        if (!preset) {
          return current;
        }
        // Merge over `defaults` (not `current`) so any static catalog
        // window the preset doesn't mention still has a valid entry,
        // mirroring reset()'s safety net.
        return persistLayout({ ...defaults, ...preset });
      });
    },
    [presets, defaults, persistLayout],
  );

  // Overwrites the layout wholesale with server-fetched data (KAN-104) —
  // same shape as applying a preset, but the source is myWorkspaceState
  // instead of a local named snapshot. Merges over `defaults` for the same
  // reason applyPreset does: a server snapshot saved before a since-added
  // static window shouldn't leave that window without a valid entry.
  const hydrateLayout = useCallback(
    (serverLayout: LayoutMap) => {
      setLayout(() => persistLayout({ ...defaults, ...serverLayout }));
    },
    [defaults, persistLayout],
  );

  const startDrag = useCallback(
    (
      id: string,
      event: ReactPointerEvent,
      boardEl: HTMLElement,
      windowEl: HTMLElement,
      // Fires as the pointer arms or disarms an edge zone, so the board can
      // show a snap preview. The zone itself is applied here on pointerup.
      onSnapZoneChange?: (zone: SnapZone | null) => void,
    ) => {
      bringToFront(id);
      const boardRect = boardEl.getBoundingClientRect();
      const board: BoardSize = {
        width: boardRect.width,
        height: boardRect.height,
      };
      const windowRect = windowEl.getBoundingClientRect();
      const startedMaximized = Boolean(layoutRef.current[id]?.maximized);
      const restore = layoutRef.current[id]?.restore;
      let offsetX = event.clientX - windowRect.left;
      let offsetY = event.clientY - windowRect.top;
      let unmaximized = false;
      let latest: { x: number; y: number } | null = null;
      let zone: SnapZone | null = null;

      // The gesture drives the DOM directly and only commits to React state
      // on pointerup. Calling a state setter per pointermove instead
      // re-rendered the whole board — and with it every open window's
      // content, Leaflet map and relationship graph included — at pointer
      // event rate, which is what made dragging anything feel sluggish once
      // a few windows were up.
      function handleMove(moveEvent: PointerEvent) {
        // Dragging a maximized window pulls it back down to its restored
        // size under the cursor, the way every real window manager does.
        if (startedMaximized && !unmaximized) {
          unmaximized = true;
          const geometry = restoreGeometry(restore, board);
          windowEl.style.width = `${geometry.width}px`;
          windowEl.style.height = `${geometry.height}px`;
          offsetX = geometry.width / 2;
          offsetY = Math.min(offsetY, 24);
        }

        const width = windowEl.offsetWidth;
        const height = windowEl.offsetHeight;
        const rawX = moveEvent.clientX - boardRect.left - offsetX;
        const rawY = moveEvent.clientY - boardRect.top - offsetY;
        const x = Math.max(0, Math.min(rawX, board.width - width));
        const y = Math.max(0, Math.min(rawY, board.height - height));
        latest = { x, y };
        windowEl.style.left = `${x}px`;
        windowEl.style.top = `${y}px`;

        const nextZone = zoneForPointer(
          moveEvent.clientX - boardRect.left,
          moveEvent.clientY - boardRect.top,
          board,
        );
        if (nextZone !== zone) {
          zone = nextZone;
          onSnapZoneChange?.(zone);
        }
      }

      function handleUp() {
        window.removeEventListener("pointermove", handleMove);
        window.removeEventListener("pointerup", handleUp);
        onSnapZoneChange?.(null);

        if (zone) {
          snapWindow(id, zone, board);
          return;
        }
        // Null when the pointer never moved (a plain title-bar click), where
        // committing would mean a pointless render and localStorage write.
        if (!latest) {
          return;
        }
        if (unmaximized) {
          const restored = restoreGeometry(restore, board);
          commitGeometry(
            id,
            { ...latest, width: restored.width, height: restored.height },
            { maximized: false, restore: undefined },
          );
          return;
        }
        commitGeometry(id, latest);
      }

      window.addEventListener("pointermove", handleMove);
      window.addEventListener("pointerup", handleUp);
    },
    [bringToFront, commitGeometry, snapWindow],
  );

  const startResize = useCallback(
    (
      id: string,
      event: ReactPointerEvent,
      boardEl: HTMLElement,
      windowEl: HTMLElement,
    ) => {
      bringToFront(id);
      const boardRect = boardEl.getBoundingClientRect();
      const windowRect = windowEl.getBoundingClientRect();
      const startX = event.clientX;
      const startY = event.clientY;
      const startWidth = windowRect.width;
      const startHeight = windowRect.height;
      let latest: { width: number; height: number } | null = null;

      // Same DOM-first approach as startDrag, and it matters even more here:
      // a resize changes each window's content layout, so a state update per
      // pointermove made every open window re-flow on every frame.
      function handleMove(moveEvent: PointerEvent) {
        const rawWidth = startWidth + (moveEvent.clientX - startX);
        const rawHeight = startHeight + (moveEvent.clientY - startY);
        const width = Math.max(
          MIN_WIDTH,
          Math.min(rawWidth, boardRect.right - windowRect.left),
        );
        const height = Math.max(
          MIN_HEIGHT,
          Math.min(rawHeight, boardRect.bottom - windowRect.top),
        );
        latest = { width, height };
        windowEl.style.width = `${width}px`;
        windowEl.style.height = `${height}px`;
      }

      function handleUp() {
        window.removeEventListener("pointermove", handleMove);
        window.removeEventListener("pointerup", handleUp);
        if (latest) {
          // Resizing a maximized window is the user sizing it by hand, so it
          // stops being maximized rather than keeping a flag that no longer
          // describes its geometry.
          commitGeometry(id, latest, { maximized: false, restore: undefined });
        }
      }

      window.addEventListener("pointermove", handleMove);
      window.addEventListener("pointerup", handleUp);
    },
    [bringToFront, commitGeometry],
  );

  return {
    layout,
    bringToFront,
    toggle,
    minimize,
    restoreWindow,
    toggleMaximize,
    snapWindow,
    arrange,
    showDesktop,
    commitGeometry,
    startDrag,
    startResize,
    reset,
    openWindow,
    closeWindow,
    presets,
    savePreset,
    applyPreset,
    hydrateLayout,
  };
}
