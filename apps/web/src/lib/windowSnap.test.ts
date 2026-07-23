import { describe, expect, it } from "vitest";

import {
  cascadeGeometry,
  geometryForZone,
  restoreGeometry,
  SNAP_EDGE_PX,
  tileGeometry,
  zoneForPointer,
} from "./windowSnap";

const BOARD = { width: 1000, height: 600 };

describe("zoneForPointer", () => {
  it("arms nothing in the middle of the board", () => {
    expect(zoneForPointer(500, 300, BOARD)).toBeNull();
  });

  it("arms max at the top edge", () => {
    expect(zoneForPointer(500, SNAP_EDGE_PX, BOARD)).toBe("max");
  });

  it("arms left and right at the side edges", () => {
    expect(zoneForPointer(0, 300, BOARD)).toBe("left");
    expect(zoneForPointer(BOARD.width, 300, BOARD)).toBe("right");
  });

  // The corners are the ambiguous case: a pointer at 0,0 is on both the top
  // and the left edge, and "maximize" is the gesture people mean there.
  it("prefers max over a side zone in the corners", () => {
    expect(zoneForPointer(0, 0, BOARD)).toBe("max");
    expect(zoneForPointer(BOARD.width, 0, BOARD)).toBe("max");
  });
});

describe("geometryForZone", () => {
  it("fills the board for max", () => {
    expect(geometryForZone("max", BOARD)).toEqual({
      x: 0,
      y: 0,
      width: 1000,
      height: 600,
    });
  });

  it("splits the board into halves that meet exactly", () => {
    const left = geometryForZone("left", BOARD);
    const right = geometryForZone("right", BOARD);

    expect(left.x + left.width).toBe(right.x);
    expect(right.x + right.width).toBe(BOARD.width);
    expect(left.height).toBe(BOARD.height);
  });

  // Rounding a half of an odd width down for the left pane would leave a
  // one-pixel strip of wallpaper between the two snapped windows.
  it("leaves no gap on an odd-width board", () => {
    const odd = { width: 999, height: 600 };
    const left = geometryForZone("left", odd);
    const right = geometryForZone("right", odd);

    expect(left.width + right.width).toBe(odd.width);
  });
});

describe("tileGeometry", () => {
  it("lays two windows out side by side", () => {
    const first = tileGeometry(0, 2, BOARD);
    const second = tileGeometry(1, 2, BOARD);

    expect(second.x).toBeGreaterThan(first.x);
    expect(first.y).toBe(second.y);
  });

  it("wraps onto a second row once the columns are full", () => {
    const third = tileGeometry(2, 4, BOARD);

    expect(third.x).toBe(tileGeometry(0, 4, BOARD).x);
    expect(third.y).toBeGreaterThan(tileGeometry(0, 4, BOARD).y);
  });

  it("keeps every tile inside the board", () => {
    for (let index = 0; index < 5; index += 1) {
      const tile = tileGeometry(index, 5, BOARD);

      expect(tile.x + tile.width).toBeLessThanOrEqual(BOARD.width);
      expect(tile.y + tile.height).toBeLessThanOrEqual(BOARD.height);
    }
  });
});

describe("cascadeGeometry", () => {
  it("steps each window down and to the right", () => {
    const first = cascadeGeometry(0, BOARD);
    const second = cascadeGeometry(1, BOARD);

    expect(second.x).toBeGreaterThan(first.x);
    expect(second.y).toBeGreaterThan(first.y);
    expect(second.width).toBe(first.width);
  });

  it("stops stepping instead of marching off the board", () => {
    const far = cascadeGeometry(50, BOARD);

    expect(far.x + far.width).toBeLessThanOrEqual(BOARD.width);
    expect(far.y + far.height).toBeLessThanOrEqual(BOARD.height);
  });
});

describe("restoreGeometry", () => {
  it("returns the captured geometry when there is one", () => {
    const captured = { x: 12, y: 34, width: 300, height: 200 };

    expect(restoreGeometry(captured, BOARD)).toEqual(captured);
  });

  // A layout persisted before maximize existed has no `restore` entry, so
  // un-maximizing has to invent something reachable rather than 0,0.
  it("centers a default when nothing was captured", () => {
    const fallback = restoreGeometry(undefined, BOARD);

    expect(fallback.x).toBeGreaterThan(0);
    expect(fallback.y).toBeGreaterThan(0);
    expect(fallback.x + fallback.width).toBeLessThanOrEqual(BOARD.width);
    expect(fallback.y + fallback.height).toBeLessThanOrEqual(BOARD.height);
  });
});
