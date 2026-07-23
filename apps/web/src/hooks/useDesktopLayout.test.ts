import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { useDesktopLayout } from "./useDesktopLayout";
import type { LayoutMap } from "./useDesktopLayout";

const DEFAULTS: LayoutMap = {
  npcs: { x: 28, y: 24, width: 310, height: 280, hidden: false, z: 2 },
  notes: { x: 526, y: 362, width: 360, height: 240, hidden: true, z: 1 },
};

beforeEach(() => {
  localStorage.clear();
});

describe("useDesktopLayout", () => {
  it("starts from the provided defaults when nothing is stored", () => {
    const { result } = renderHook(() => useDesktopLayout("camp-1", DEFAULTS));

    expect(result.current.layout).toEqual(DEFAULTS);
  });

  it("toggle flips hidden and brings a newly-opened window to front", () => {
    const { result } = renderHook(() => useDesktopLayout("camp-1", DEFAULTS));

    act(() => result.current.toggle("notes"));

    expect(result.current.layout.notes.hidden).toBe(false);
    expect(result.current.layout.notes.z).toBeGreaterThan(DEFAULTS.npcs.z);
  });

  it("toggle hides an open window without changing its z", () => {
    const { result } = renderHook(() => useDesktopLayout("camp-1", DEFAULTS));

    act(() => result.current.toggle("npcs"));

    expect(result.current.layout.npcs.hidden).toBe(true);
    expect(result.current.layout.npcs.z).toBe(DEFAULTS.npcs.z);
  });

  it("bringToFront raises z above every other window", () => {
    const { result } = renderHook(() => useDesktopLayout("camp-1", DEFAULTS));

    act(() => result.current.bringToFront("notes"));

    expect(result.current.layout.notes.z).toBeGreaterThan(
      result.current.layout.npcs.z,
    );
  });

  // Fires on every pointerdown inside a window, so the already-on-top case
  // has to be free: no new layout object (React bails out of the re-render)
  // and no JSON.stringify of the whole layout into localStorage.
  it("bringToFront is a no-op when the window is already on top", () => {
    const { result } = renderHook(() => useDesktopLayout("camp-1", DEFAULTS));
    const before = result.current.layout;

    act(() => result.current.bringToFront("npcs"));

    expect(result.current.layout).toBe(before);
    expect(localStorage.getItem("storyforge:desktop:camp-1")).toBeNull();
  });

  // What a finished drag/resize gesture calls once on pointerup — the
  // gesture itself drives the DOM directly and never touches state.
  it("commitGeometry applies and persists a finished gesture", () => {
    const { result } = renderHook(() => useDesktopLayout("camp-1", DEFAULTS));

    act(() => result.current.commitGeometry("npcs", { x: 200, y: 150 }));

    expect(result.current.layout.npcs).toMatchObject({ x: 200, y: 150 });
    const stored = JSON.parse(
      localStorage.getItem("storyforge:desktop:camp-1")!,
    );
    expect(stored.npcs).toMatchObject({ x: 200, y: 150 });
  });

  it("commitGeometry ignores an id that is no longer in the layout", () => {
    const { result } = renderHook(() => useDesktopLayout("camp-1", DEFAULTS));
    const before = result.current.layout;

    act(() => result.current.commitGeometry("gone", { x: 1, y: 1 }));

    expect(result.current.layout).toBe(before);
  });

  it("persists toggle to localStorage, readable by a fresh hook instance", () => {
    const { result, unmount } = renderHook(() =>
      useDesktopLayout("camp-1", DEFAULTS),
    );
    act(() => result.current.toggle("notes"));
    unmount();

    const { result: fresh } = renderHook(() =>
      useDesktopLayout("camp-1", DEFAULTS),
    );
    expect(fresh.current.layout.notes.hidden).toBe(false);
  });

  it("reset clears storage and restores defaults", () => {
    const { result } = renderHook(() => useDesktopLayout("camp-1", DEFAULTS));
    act(() => result.current.toggle("notes"));
    act(() => result.current.reset());

    expect(result.current.layout).toEqual(DEFAULTS);
    expect(localStorage.getItem("storyforge:desktop:camp-1")).toBeNull();
  });

  it("openWindow inserts a new id at the given defaults, unhidden and on top", () => {
    const { result } = renderHook(() => useDesktopLayout("camp-1", DEFAULTS));

    act(() =>
      result.current.openWindow("entity:1", {
        x: 10,
        y: 20,
        width: 300,
        height: 200,
      }),
    );

    expect(result.current.layout["entity:1"]).toMatchObject({
      x: 10,
      y: 20,
      width: 300,
      height: 200,
      hidden: false,
    });
    expect(result.current.layout["entity:1"].z).toBeGreaterThan(
      DEFAULTS.npcs.z,
    );
  });

  it("openWindow on an already-open id brings it to front without resetting position", () => {
    const { result } = renderHook(() => useDesktopLayout("camp-1", DEFAULTS));

    act(() =>
      result.current.openWindow("entity:1", {
        x: 10,
        y: 20,
        width: 300,
        height: 200,
      }),
    );
    act(() => result.current.commitGeometry("entity:1", { x: 555, y: 666 }));
    act(() => result.current.bringToFront("npcs"));
    act(() =>
      result.current.openWindow("entity:1", {
        x: 0,
        y: 0,
        width: 999,
        height: 999,
      }),
    );

    expect(result.current.layout["entity:1"]).toMatchObject({
      x: 555,
      y: 666,
    });
    expect(result.current.layout["entity:1"].z).toBeGreaterThan(
      result.current.layout.npcs.z,
    );
  });

  it("closeWindow removes the id from the layout entirely", () => {
    const { result } = renderHook(() => useDesktopLayout("camp-1", DEFAULTS));

    act(() =>
      result.current.openWindow("entity:1", {
        x: 10,
        y: 20,
        width: 300,
        height: 200,
      }),
    );
    act(() => result.current.closeWindow("entity:1"));

    expect(result.current.layout["entity:1"]).toBeUndefined();
    const stored = JSON.parse(
      localStorage.getItem("storyforge:desktop:camp-1")!,
    );
    expect(stored["entity:1"]).toBeUndefined();
  });

  it("reset restores static defaults but leaves dynamically-opened windows alone", () => {
    const { result } = renderHook(() => useDesktopLayout("camp-1", DEFAULTS));

    act(() => result.current.toggle("notes"));
    act(() =>
      result.current.openWindow("entity:1", {
        x: 10,
        y: 20,
        width: 300,
        height: 200,
      }),
    );
    act(() => result.current.reset());

    expect(result.current.layout.npcs).toEqual(DEFAULTS.npcs);
    expect(result.current.layout.notes).toEqual(DEFAULTS.notes);
    expect(result.current.layout["entity:1"]).toMatchObject({
      x: 10,
      y: 20,
    });
    const stored = JSON.parse(
      localStorage.getItem("storyforge:desktop:camp-1")!,
    );
    expect(stored["entity:1"]).toBeDefined();
  });

  it("savePreset snapshots the current layout under a name", () => {
    const { result } = renderHook(() => useDesktopLayout("camp-1", DEFAULTS));

    act(() => result.current.commitGeometry("npcs", { x: 200, y: 150 }));
    act(() => result.current.savePreset("Session Prep"));

    expect(result.current.presets["Session Prep"].npcs).toMatchObject({
      x: 200,
      y: 150,
    });
    const stored = JSON.parse(
      localStorage.getItem("storyforge:desktop:camp-1:presets")!,
    );
    expect(stored["Session Prep"].npcs).toMatchObject({ x: 200, y: 150 });
  });

  it("applyPreset restores a saved arrangement", () => {
    const { result } = renderHook(() => useDesktopLayout("camp-1", DEFAULTS));

    act(() => result.current.commitGeometry("npcs", { x: 200, y: 150 }));
    act(() => result.current.savePreset("Session Prep"));
    act(() => result.current.commitGeometry("npcs", { x: 999, y: 999 }));
    act(() => result.current.applyPreset("Session Prep"));

    expect(result.current.layout.npcs).toMatchObject({ x: 200, y: 150 });
  });

  it("applyPreset falls back to defaults for static ids the preset doesn't mention", () => {
    // Simulate a preset that only ever captured one window (e.g. saved
    // before "notes" existed) by writing a partial snapshot directly.
    localStorage.setItem(
      "storyforge:desktop:camp-1:presets",
      JSON.stringify({ Partial: { npcs: DEFAULTS.npcs } }),
    );
    const { result } = renderHook(() => useDesktopLayout("camp-1", DEFAULTS));

    act(() => result.current.applyPreset("Partial"));

    expect(result.current.layout.notes).toEqual(DEFAULTS.notes);
  });

  it("applyPreset is a no-op for an unknown name", () => {
    const { result } = renderHook(() => useDesktopLayout("camp-1", DEFAULTS));

    act(() => result.current.commitGeometry("npcs", { x: 200, y: 150 }));
    act(() => result.current.applyPreset("Nonexistent"));

    expect(result.current.layout.npcs).toMatchObject({ x: 200, y: 150 });
  });

  it("persists presets to localStorage, readable by a fresh hook instance", () => {
    const { result, unmount } = renderHook(() =>
      useDesktopLayout("camp-1", DEFAULTS),
    );
    act(() => result.current.savePreset("Session Prep"));
    unmount();

    const { result: fresh } = renderHook(() =>
      useDesktopLayout("camp-1", DEFAULTS),
    );
    expect(fresh.current.presets["Session Prep"]).toBeDefined();
  });

  it("hydrateLayout overwrites the layout wholesale and persists it", () => {
    const { result } = renderHook(() => useDesktopLayout("camp-1", DEFAULTS));

    act(() => result.current.commitGeometry("npcs", { x: 999, y: 999 }));
    act(() =>
      result.current.hydrateLayout({
        npcs: { x: 1, y: 2, width: 3, height: 4, hidden: false, z: 5 },
      }),
    );

    expect(result.current.layout.npcs).toMatchObject({ x: 1, y: 2 });
    const stored = JSON.parse(
      localStorage.getItem("storyforge:desktop:camp-1")!,
    );
    expect(stored.npcs).toMatchObject({ x: 1, y: 2 });
  });

  it("hydrateLayout falls back to defaults for static ids it doesn't mention", () => {
    const { result } = renderHook(() => useDesktopLayout("camp-1", DEFAULTS));

    act(() => result.current.hydrateLayout({ npcs: DEFAULTS.npcs }));

    expect(result.current.layout.notes).toEqual(DEFAULTS.notes);
  });

  it("scopes storage per campaign id", () => {
    const { result: campaignA } = renderHook(() =>
      useDesktopLayout("camp-a", DEFAULTS),
    );
    act(() => campaignA.current.toggle("notes"));

    const { result: campaignB } = renderHook(() =>
      useDesktopLayout("camp-b", DEFAULTS),
    );
    expect(campaignB.current.layout.notes.hidden).toBe(true);
  });

  describe("minimize", () => {
    it("rolls a window down to the taskbar without closing it", () => {
      const { result } = renderHook(() => useDesktopLayout("camp-1", DEFAULTS));

      act(() => result.current.minimize("npcs"));

      expect(result.current.layout.npcs.minimized).toBe(true);
      expect(result.current.layout.npcs.hidden).toBe(false);
    });

    it("restoreWindow brings it back and puts it on top", () => {
      const { result } = renderHook(() => useDesktopLayout("camp-1", DEFAULTS));

      act(() => result.current.minimize("npcs"));
      act(() => result.current.restoreWindow("npcs"));

      expect(result.current.layout.npcs.minimized).toBe(false);
      expect(result.current.layout.npcs.z).toBeGreaterThan(
        result.current.layout.notes.z,
      );
    });

    // Reopening from the desktop nav has to show the window, not hand back
    // an invisible one that's still rolled down.
    it("toggling a minimized-then-closed window back open un-minimizes it", () => {
      const { result } = renderHook(() => useDesktopLayout("camp-1", DEFAULTS));

      act(() => result.current.minimize("npcs"));
      act(() => result.current.toggle("npcs"));
      act(() => result.current.toggle("npcs"));

      expect(result.current.layout.npcs).toMatchObject({
        hidden: false,
        minimized: false,
      });
    });

    it("openWindow un-minimizes an existing dynamic window", () => {
      const { result } = renderHook(() => useDesktopLayout("camp-1", DEFAULTS));
      const geometry = { x: 10, y: 20, width: 300, height: 200 };

      act(() => result.current.openWindow("entity:1", geometry));
      act(() => result.current.minimize("entity:1"));
      act(() => result.current.openWindow("entity:1", geometry));

      expect(result.current.layout["entity:1"].minimized).toBe(false);
    });
  });

  describe("maximize", () => {
    const BOARD = { width: 1000, height: 600 };

    it("fills the board and remembers where it came from", () => {
      const { result } = renderHook(() => useDesktopLayout("camp-1", DEFAULTS));

      act(() => result.current.toggleMaximize("npcs", BOARD));

      expect(result.current.layout.npcs).toMatchObject({
        x: 0,
        y: 0,
        width: 1000,
        height: 600,
        maximized: true,
        restore: {
          x: DEFAULTS.npcs.x,
          y: DEFAULTS.npcs.y,
          width: DEFAULTS.npcs.width,
          height: DEFAULTS.npcs.height,
        },
      });
    });

    it("un-maximizing returns to the captured geometry", () => {
      const { result } = renderHook(() => useDesktopLayout("camp-1", DEFAULTS));

      act(() => result.current.toggleMaximize("npcs", BOARD));
      act(() => result.current.toggleMaximize("npcs", BOARD));

      expect(result.current.layout.npcs).toMatchObject({
        x: DEFAULTS.npcs.x,
        y: DEFAULTS.npcs.y,
        width: DEFAULTS.npcs.width,
        height: DEFAULTS.npcs.height,
        maximized: false,
      });
    });

    it("survives a reload", () => {
      const { result, unmount } = renderHook(() =>
        useDesktopLayout("camp-1", DEFAULTS),
      );
      act(() => result.current.toggleMaximize("npcs", BOARD));
      unmount();

      const { result: fresh } = renderHook(() =>
        useDesktopLayout("camp-1", DEFAULTS),
      );
      expect(fresh.current.layout.npcs.maximized).toBe(true);
    });

    it("snapWindow sizes a window to the requested half", () => {
      const { result } = renderHook(() => useDesktopLayout("camp-1", DEFAULTS));

      act(() => result.current.snapWindow("npcs", "right", BOARD));

      expect(result.current.layout.npcs).toMatchObject({
        x: 500,
        y: 0,
        width: 500,
        height: 600,
        maximized: false,
      });
    });

    // A half-snapped window that gets maximized should fall back to the half
    // it was occupying, not to wherever it sat before the snap.
    it("un-maximizing a half-snapped window returns to the half", () => {
      const { result } = renderHook(() => useDesktopLayout("camp-1", DEFAULTS));

      act(() => result.current.snapWindow("npcs", "left", BOARD));
      act(() => result.current.toggleMaximize("npcs", BOARD));
      act(() => result.current.toggleMaximize("npcs", BOARD));

      expect(result.current.layout.npcs).toMatchObject({
        x: 0,
        width: 500,
        height: 600,
      });
    });
  });

  describe("arrange", () => {
    const BOARD = { width: 1000, height: 600 };

    it("tiles every window that is on the board", () => {
      const { result } = renderHook(() => useDesktopLayout("camp-1", DEFAULTS));

      act(() => result.current.toggle("notes"));
      act(() => result.current.arrange("tile", BOARD));

      expect(result.current.layout.npcs.x).not.toBe(
        result.current.layout.notes.x,
      );
      expect(result.current.layout.npcs.width).toBe(
        result.current.layout.notes.width,
      );
    });

    it("leaves closed and minimized windows out of the arrangement", () => {
      const { result } = renderHook(() => useDesktopLayout("camp-1", DEFAULTS));

      act(() => result.current.arrange("cascade", BOARD));

      // "notes" ships hidden in DEFAULTS, so cascading shouldn't move it.
      expect(result.current.layout.notes).toMatchObject({
        x: DEFAULTS.notes.x,
        y: DEFAULTS.notes.y,
      });
    });

    it("clears maximized so the arranged geometry is the real one", () => {
      const { result } = renderHook(() => useDesktopLayout("camp-1", DEFAULTS));

      act(() => result.current.toggleMaximize("npcs", BOARD));
      act(() => result.current.arrange("tile", BOARD));

      expect(result.current.layout.npcs.maximized).toBe(false);
    });
  });

  describe("showDesktop", () => {
    it("minimizes everything on the board, then brings it all back", () => {
      const { result } = renderHook(() => useDesktopLayout("camp-1", DEFAULTS));

      act(() => result.current.showDesktop());
      expect(result.current.layout.npcs.minimized).toBe(true);

      act(() => result.current.showDesktop());
      expect(result.current.layout.npcs.minimized).toBe(false);
    });

    it("does not reopen closed windows", () => {
      const { result } = renderHook(() => useDesktopLayout("camp-1", DEFAULTS));

      act(() => result.current.showDesktop());
      act(() => result.current.showDesktop());

      expect(result.current.layout.notes.hidden).toBe(true);
    });
  });

  // Layouts persisted before minimize/maximize existed — and every server
  // snapshot saved by an older client — have none of the new keys.
  it("loads a layout persisted without the new window-state fields", () => {
    localStorage.setItem(
      "storyforge:desktop:camp-1",
      JSON.stringify({
        npcs: { x: 5, y: 6, width: 100, height: 90, hidden: false, z: 4 },
      }),
    );

    const { result } = renderHook(() => useDesktopLayout("camp-1", DEFAULTS));

    expect(result.current.layout.npcs).toMatchObject({ x: 5, y: 6 });
    expect(result.current.layout.npcs.minimized).toBeUndefined();
    expect(result.current.layout.npcs.maximized).toBeUndefined();
  });
});
