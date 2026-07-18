import type { ReactNode } from "react";

import { useDesktopWindows } from "../lib/DesktopWindowsContext";

export type AddEditMode<T> = { mode: "create" } | { mode: "edit"; item: T };

export interface UseAddEditWindowOptions {
  // Window ids become `${idPrefix}:new` or `${idPrefix}:${item.id}`, so
  // create and each concurrently-edited item get independent, positioned
  // windows — instead of one dialog reused for every mode — and fall under
  // the existing layout/preset system like any other window (KAN-101).
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
    const key = mode.mode === "edit" ? mode.item.id : "new";
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
