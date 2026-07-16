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

  const persist = useCallback(() => {
    setLayout((current) => persistLayout(current));
  }, [persistLayout]);

  const reset = useCallback(() => {
    localStorage.removeItem(storageKey(campaignId));
    setLayout(defaults);
  }, [campaignId, defaults]);

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

  return { layout, bringToFront, toggle, move, startDrag, reset };
}
