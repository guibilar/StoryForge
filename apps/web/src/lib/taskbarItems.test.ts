import { describe, expect, it } from "vitest";
import { CalendarDays, StickyNote } from "lucide-react";

import { activeWindowId, buildTaskbarItems } from "./taskbarItems";
import type { LayoutMap } from "../hooks/useDesktopLayout";
import type { WindowCatalogEntry } from "./windowCatalog";

const CATALOG: WindowCatalogEntry[] = [
  {
    id: "sessions",
    title: "Sessions",
    icon: CalendarDays,
    render: () => null,
  },
  { id: "notes", title: "Notes", icon: StickyNote, render: () => null },
];

const DYNAMIC = { "entity:1": { title: "Wren", render: () => null } };

function layoutOf(overrides: LayoutMap = {}) {
  const base: LayoutMap = {
    sessions: { x: 0, y: 0, width: 300, height: 200, hidden: false, z: 2 },
    notes: { x: 0, y: 0, width: 300, height: 200, hidden: true, z: 1 },
    "entity:1": { x: 0, y: 0, width: 300, height: 200, hidden: false, z: 3 },
  };
  return { ...base, ...overrides };
}

describe("buildTaskbarItems", () => {
  it("lists open windows only, catalog first then dynamic", () => {
    const items = buildTaskbarItems({
      layout: layoutOf(),
      catalog: CATALOG,
      dynamicWindows: DYNAMIC,
    });

    expect(items.map((item) => item.id)).toEqual(["sessions", "entity:1"]);
  });

  it("marks the top of the stack active", () => {
    const items = buildTaskbarItems({
      layout: layoutOf(),
      catalog: CATALOG,
      dynamicWindows: DYNAMIC,
    });

    expect(items.find((item) => item.id === "entity:1")?.state).toBe("active");
    expect(items.find((item) => item.id === "sessions")?.state).toBe("open");
  });

  // A minimized window is still open — it keeps its button, and the focus
  // ring moves to whatever is actually on the board.
  it("keeps minimized windows on the bar and out of the active slot", () => {
    const items = buildTaskbarItems({
      layout: layoutOf({
        "entity:1": {
          x: 0,
          y: 0,
          width: 300,
          height: 200,
          hidden: false,
          z: 3,
          minimized: true,
        },
      }),
      catalog: CATALOG,
      dynamicWindows: DYNAMIC,
    });

    expect(items.find((item) => item.id === "entity:1")?.state).toBe(
      "minimized",
    );
    expect(items.find((item) => item.id === "sessions")?.state).toBe("active");
  });

  it("carries the catalog icon through", () => {
    const items = buildTaskbarItems({
      layout: layoutOf(),
      catalog: CATALOG,
      dynamicWindows: {},
    });

    expect(items[0].icon).toBe(CalendarDays);
  });
});

describe("activeWindowId", () => {
  it("is null when nothing is on the board", () => {
    expect(
      activeWindowId({
        layout: {
          sessions: {
            x: 0,
            y: 0,
            width: 1,
            height: 1,
            hidden: true,
            z: 1,
          },
        },
      }),
    ).toBeNull();
  });
});
