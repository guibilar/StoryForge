// Pure geometry for the desktop shell's window arrangement: edge snapping
// during a drag, maximize, and the tile/cascade commands. Kept DOM-free (the
// caller measures the board and passes its size in) so every rule here is
// unit-testable without a layout engine — same split as graphLayout.ts.

export type SnapZone = "max" | "left" | "right";

export interface BoardSize {
  width: number;
  height: number;
}

export interface WindowGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
}

// How close to an edge the pointer has to get before a drag arms a snap.
// Deliberately small: a window dragged to sit flush against the left edge is
// a normal thing to want, and shouldn't silently become a half-screen snap.
export const SNAP_EDGE_PX = 8;

const TILE_GAP = 8;
const CASCADE_STEP = 30;
const CASCADE_ORIGIN = 32;
const CASCADE_WIDTH = 420;
const CASCADE_HEIGHT = 320;
const MIN_TILE = 120;

// Which zone a pointer at (x, y) — board-relative — is arming, if any. Top
// wins over the side edges so the corners behave like "maximize", matching
// the drag-to-top-to-maximize gesture people already expect.
export function zoneForPointer(
  x: number,
  y: number,
  board: BoardSize,
): SnapZone | null {
  if (y <= SNAP_EDGE_PX) {
    return "max";
  }
  if (x <= SNAP_EDGE_PX) {
    return "left";
  }
  if (x >= board.width - SNAP_EDGE_PX) {
    return "right";
  }
  return null;
}

export function geometryForZone(
  zone: SnapZone,
  board: BoardSize,
): WindowGeometry {
  const half = Math.round(board.width / 2);

  if (zone === "left") {
    return { x: 0, y: 0, width: half, height: board.height };
  }
  if (zone === "right") {
    return { x: half, y: 0, width: board.width - half, height: board.height };
  }
  return { x: 0, y: 0, width: board.width, height: board.height };
}

// Grid placement for the "Tile" command. Columns come from the square root so
// the grid stays roughly square (3 windows → 2x2 with one gap, 5 → 3x2),
// which reads better than a single long row once more than two are open.
export function tileGeometry(
  index: number,
  count: number,
  board: BoardSize,
): WindowGeometry {
  const columns = Math.max(1, Math.ceil(Math.sqrt(count)));
  const rows = Math.max(1, Math.ceil(count / columns));
  const cellWidth = board.width / columns;
  const cellHeight = board.height / rows;

  return {
    x: Math.round((index % columns) * cellWidth + TILE_GAP / 2),
    y: Math.round(Math.floor(index / columns) * cellHeight + TILE_GAP / 2),
    width: Math.max(MIN_TILE, Math.round(cellWidth - TILE_GAP)),
    height: Math.max(MIN_TILE, Math.round(cellHeight - TILE_GAP)),
  };
}

// Staircase placement for the "Cascade" command. Every window gets the same
// size; only the offset changes, and it stops stepping once the next step
// would push a window off the board rather than marching off-screen.
export function cascadeGeometry(
  index: number,
  board: BoardSize,
): WindowGeometry {
  const width = Math.max(MIN_TILE, Math.min(CASCADE_WIDTH, board.width - 40));
  const height = Math.max(
    MIN_TILE,
    Math.min(CASCADE_HEIGHT, board.height - 40),
  );
  const offset = index * CASCADE_STEP;

  return {
    x: Math.max(0, Math.min(CASCADE_ORIGIN + offset, board.width - width)),
    y: Math.max(0, Math.min(CASCADE_ORIGIN + offset, board.height - height)),
    width,
    height,
  };
}

// Where a window should land when it stops being maximized. `restore` is the
// geometry captured before it was maximized/snapped; it can be missing (a
// layout persisted before this existed, or hand-edited state), in which case
// a centered default keeps the window reachable instead of at 0,0 under the
// title bar it was just dragged from.
export function restoreGeometry(
  restore: WindowGeometry | undefined,
  board: BoardSize,
): WindowGeometry {
  if (restore) {
    return restore;
  }

  const width = Math.max(MIN_TILE, Math.min(CASCADE_WIDTH, board.width - 80));
  const height = Math.max(
    MIN_TILE,
    Math.min(CASCADE_HEIGHT, board.height - 80),
  );

  return {
    x: Math.round((board.width - width) / 2),
    y: Math.round((board.height - height) / 2),
    width,
    height,
  };
}
