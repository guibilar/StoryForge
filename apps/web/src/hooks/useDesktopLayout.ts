import { useCallback, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

import { markLocalWorkspaceWrite } from "../lib/workspaceClock";

export interface WindowLayout {
  x: number;
  y: number;
  width: number;
  height: number;
  hidden: boolean;
  z: number;
}

export type LayoutMap = Record<string, WindowLayout>;

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

export function useDesktopLayout(campaignId: string, defaults: LayoutMap) {
  const [layout, setLayout] = useState<LayoutMap>(() =>
    loadLayout(campaignId, defaults),
  );
  const [presets, setPresets] = useState<Record<string, LayoutMap>>(() =>
    loadPresets(campaignId),
  );

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
            ? { ...existing, hidden: false, z: maxZ(current) + 1 }
            : { ...defaults, hidden: false, z: maxZ(current) + 1 },
        });
      });
    },
    [persistLayout],
  );

  // Removes a dynamically-opened window entirely, unlike `toggle` which only
  // hides a static catalog window (so the sidebar nav can still reopen it).
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
            z: wasHidden ? maxZ(current) + 1 : current[id].z,
          },
        });
      });
    },
    [persistLayout],
  );

  const move = useCallback((id: string, x: number, y: number) => {
    setLayout((current) => ({ ...current, [id]: { ...current[id], x, y } }));
  }, []);

  const resize = useCallback((id: string, width: number, height: number) => {
    setLayout((current) => ({
      ...current,
      [id]: { ...current[id], width, height },
    }));
  }, []);

  // Applies the geometry a whole drag/resize gesture produced in one update.
  // Splitting it out from move()/resize() is what lets those gestures cost a
  // single React render at the end instead of one per pointermove — see
  // startDrag for why that matters so much here.
  const commitGeometry = useCallback(
    (
      id: string,
      geometry: Partial<Pick<WindowLayout, "x" | "y" | "width" | "height">>,
    ) => {
      setLayout((current) =>
        persistLayout({ ...current, [id]: { ...current[id], ...geometry } }),
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
    ) => {
      bringToFront(id);
      const boardRect = boardEl.getBoundingClientRect();
      const windowRect = windowEl.getBoundingClientRect();
      const offsetX = event.clientX - windowRect.left;
      const offsetY = event.clientY - windowRect.top;
      let latest: { x: number; y: number } | null = null;

      // The gesture drives the DOM directly and only commits to React state
      // on pointerup. Calling move() per pointermove instead re-rendered the
      // whole board — and with it every open window's content, Leaflet map
      // and relationship graph included — at pointer-event rate, which is
      // what made dragging anything feel sluggish once a few windows were up.
      function handleMove(moveEvent: PointerEvent) {
        const rawX = moveEvent.clientX - boardRect.left - offsetX;
        const rawY = moveEvent.clientY - boardRect.top - offsetY;
        const x = Math.max(
          0,
          Math.min(rawX, boardRect.width - windowRect.width),
        );
        const y = Math.max(
          0,
          Math.min(rawY, boardRect.height - windowRect.height),
        );
        latest = { x, y };
        windowEl.style.left = `${x}px`;
        windowEl.style.top = `${y}px`;
      }

      function handleUp() {
        window.removeEventListener("pointermove", handleMove);
        window.removeEventListener("pointerup", handleUp);
        // Null when the pointer never moved (a plain title-bar click), where
        // committing would mean a pointless render and localStorage write.
        if (latest) {
          commitGeometry(id, latest);
        }
      }

      window.addEventListener("pointermove", handleMove);
      window.addEventListener("pointerup", handleUp);
    },
    [bringToFront, commitGeometry],
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
          commitGeometry(id, latest);
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
    move,
    resize,
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
