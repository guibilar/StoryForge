import type { LucideIcon } from "lucide-react";

import type { LayoutMap } from "../hooks/useDesktopLayout";
import { isOnBoard } from "../hooks/useDesktopLayout";
import type { TaskbarItem } from "../components/Taskbar";
import type { WindowCatalogEntry } from "./windowCatalog";
import type { DynamicWindowEntry } from "./DesktopWindowsContext";

export interface TaskbarSource {
  layout: LayoutMap;
  catalog: WindowCatalogEntry[];
  dynamicWindows: Record<string, DynamicWindowEntry>;
}

// The focused window is simply the top of the stack, which is what
// bringToFront already maintains — there is no separate "focused id" to keep
// in sync with it. Returns null when nothing is on the board.
export function activeWindowId({ layout }: Pick<TaskbarSource, "layout">) {
  return (
    Object.entries(layout)
      .filter(([, window]) => isOnBoard(window))
      .sort(([, a], [, b]) => a.z - b.z)
      .at(-1)?.[0] ?? null
  );
}

// One button per *open* window — closed catalog windows (hidden) aren't on
// the taskbar at all, minimized ones are. Catalog order first so the six
// world windows keep a stable position, then dynamic windows in the order
// they were opened, so a button doesn't jump around under the pointer.
export function buildTaskbarItems({
  layout,
  catalog,
  dynamicWindows,
}: TaskbarSource): TaskbarItem[] {
  const active = activeWindowId({ layout });

  const entries: { id: string; title: string; icon?: LucideIcon }[] = [
    ...catalog.map((entry) => ({
      id: entry.id,
      title: entry.title,
      icon: entry.icon,
    })),
    ...Object.entries(dynamicWindows).map(([id, entry]) => ({
      id,
      title: entry.title,
    })),
  ];

  return entries
    .filter((entry) => {
      const window = layout[entry.id];
      return Boolean(window) && !window.hidden;
    })
    .map((entry) => ({
      ...entry,
      state: layout[entry.id].minimized
        ? ("minimized" as const)
        : entry.id === active
          ? ("active" as const)
          : ("open" as const),
    }));
}
