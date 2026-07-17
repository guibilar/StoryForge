import { useCallback, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

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

function maxZ(layout: LayoutMap): number {
  return Math.max(0, ...Object.values(layout).map((w) => w.z));
}

export function useDesktopLayout(campaignId: string, defaults: LayoutMap) {
  const [layout, setLayout] = useState<LayoutMap>(() =>
    loadLayout(campaignId, defaults),
  );

  // Writing localStorage inside the setLayout updater (rather than reading a
  // ref afterwards) guarantees the persisted value is the one React actually
  // committed, not a stale snapshot from before the update was scheduled.
  const persistLayout = useCallback(
    (next: LayoutMap) => {
      localStorage.setItem(storageKey(campaignId), JSON.stringify(next));
      return next;
    },
    [campaignId],
  );

  const bringToFront = useCallback(
    (id: string) => {
      setLayout((current) =>
        persistLayout({
          ...current,
          [id]: { ...current[id], z: maxZ(current) + 1 },
        }),
      );
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
  // hides a static catalog window (so the Dock can still reopen it).
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

  const persist = useCallback(() => {
    setLayout((current) => persistLayout(current));
  }, [persistLayout]);

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
        move(id, x, y);
      }

      function handleUp() {
        window.removeEventListener("pointermove", handleMove);
        window.removeEventListener("pointerup", handleUp);
        persist();
      }

      window.addEventListener("pointermove", handleMove);
      window.addEventListener("pointerup", handleUp);
    },
    [bringToFront, move, persist],
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
        resize(id, width, height);
      }

      function handleUp() {
        window.removeEventListener("pointermove", handleMove);
        window.removeEventListener("pointerup", handleUp);
        persist();
      }

      window.addEventListener("pointermove", handleMove);
      window.addEventListener("pointerup", handleUp);
    },
    [bringToFront, resize, persist],
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
  };
}
