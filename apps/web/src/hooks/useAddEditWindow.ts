import type { ReactNode } from "react";

import { useDesktopWindows } from "../lib/DesktopWindowsContext";

export type AddEditMode<T> =
  | {
      mode: "create";
      // Seed values for a form opened from a gesture that already knows some
      // of the answer — e.g. clicking the map to place a marker supplies its
      // coordinates (KAN-114). The form still owns which fields it reads.
      initial?: Partial<T>;
      // Distinguishes one create window from another. Without it every
      // create collapses onto `${idPrefix}:new`, so a second create would
      // silently reuse the first window and discard whatever was typed
      // there. Callers that can open several creates in a row must pass
      // something that varies between them.
      key?: string;
    }
  | { mode: "edit"; item: T };

export interface UseAddEditWindowOptions {
  // Window ids become `${idPrefix}:new`, `${idPrefix}:new:${key}`, or
  // `${idPrefix}:${item.id}`, so create and each concurrently-edited item
  // get independent, positioned windows — instead of one dialog reused for
  // every mode — and fall under the existing layout/preset system like any
  // other window (KAN-101).
  idPrefix: string;
  width: number;
  height: number;
}

// Shared "one Window for both Add and Edit" mechanism (KAN-107). Each
// consumer supplies its own form content (mode-aware prefill, its own
// mutations) via `render`; this only owns the window id scheme, the
// cascade offset for windows opened at runtime, and closing on save.
// Mirrors useOpenEntityWindow's shape for the same reason.
export function useAddEditWindow({
  idPrefix,
  width,
  height,
}: UseAddEditWindowOptions) {
  const { openWindow, closeWindow, dynamicWindows } = useDesktopWindows();

  function openAddEditWindow<T extends { id: string }>(
    mode: AddEditMode<T>,
    title: string,
    render: (close: () => void) => ReactNode,
  ) {
    const key =
      mode.mode === "edit"
        ? mode.item.id
        : mode.key
          ? `new:${mode.key}`
          : "new";
    const id = `${idPrefix}:${key}`;
    const offset = (Object.keys(dynamicWindows).length % 6) * 24;

    openWindow({
      id,
      title,
      render: () => render(() => closeWindow(id)),
      x: 160 + offset,
      y: 96 + offset,
      width,
      height,
    });
  }

  return { openAddEditWindow };
}
