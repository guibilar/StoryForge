import type { MapPosition } from "./MapCanvas";

// Sizing and placing the name written across a territory. Pure geometry, kept
// out of MapCanvas so it can be tested — and reasoned about — without a live
// Leaflet map.

export interface LabelPoint {
  x: number;
  y: number;
}

// The linear rings of a geometry, kept as rings rather than flattened: fitting
// a label inside the shape needs to know which points form a boundary, not
// just where the boundary points are.
//
// Walks the nested coordinate arrays rather than reading coordinates[0], so a
// MultiPolygon contributes all its islands instead of only the first.
export function ringsIn(geometry: Record<string, unknown>): MapPosition[][] {
  const rings: MapPosition[][] = [];

  function isPosition(node: unknown): node is [number, number] {
    return (
      Array.isArray(node) &&
      typeof node[0] === "number" &&
      typeof node[1] === "number"
    );
  }

  function visit(node: unknown): void {
    if (!Array.isArray(node)) {
      return;
    }
    // A ring is an array whose elements are positions. Anything shallower is
    // a position itself; anything deeper is a polygon or multi-polygon.
    if (isPosition(node[0])) {
      const ring = (node as [number, number][])
        .filter(([lng, lat]) => Number.isFinite(lat) && Number.isFinite(lng))
        .map(([lng, lat]) => ({ lat, lng }));
      if (ring.length > 0) {
        rings.push(ring);
      }
      return;
    }
    for (const child of node) {
      visit(child);
    }
  }

  visit(geometry.coordinates);
  return rings;
}

// Even-odd ray casting against every ring at once. Holes fall out for free (a
// point inside a hole crosses both its ring and the outer one, so it counts as
// outside), and so do MultiPolygon islands (a point inside one island crosses
// only that island's ring).
export function isInsideRings(
  point: LabelPoint,
  rings: LabelPoint[][],
): boolean {
  let inside = false;

  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
      const a = ring[i];
      const b = ring[j];
      // Does the horizontal ray at point.y cross this edge to the right of
      // point.x? The `!==` guards the case where both ends sit on one side.
      if (
        a.y > point.y !== b.y > point.y &&
        point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x
      ) {
        inside = !inside;
      }
    }
  }

  return inside;
}

function distanceToSegment(point: LabelPoint, a: LabelPoint, b: LabelPoint) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  // A zero-length edge (duplicated vertex) degenerates to its own endpoint.
  const t =
    lengthSquared === 0
      ? 0
      : Math.max(
          0,
          Math.min(
            1,
            ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared,
          ),
        );
  const closestX = a.x + t * dx;
  const closestY = a.y + t * dy;
  return Math.hypot(point.x - closestX, point.y - closestY);
}

function distanceToRings(point: LabelPoint, rings: LabelPoint[][]): number {
  let nearest = Infinity;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
      nearest = Math.min(nearest, distanceToSegment(point, ring[i], ring[j]));
    }
  }
  return nearest;
}

// How finely the anchor search samples the bounding box. 16x16 is enough to
// land inside the body of any hand-drawn territory while staying cheap enough
// to re-run for every territory on every zoom.
const ANCHOR_GRID = 16;

// How many places to try writing the name. The deepest point inside a shape is
// not always the best one to label from: an L-shaped territory's is the elbow,
// where the text is boxed in on two sides, while either arm would hold it at
// several times the size. Trying a handful of candidates and letting the fit
// decide costs a few more tests and picks the arm.
const ANCHOR_CANDIDATES = 4;
// Candidates must be this far apart, as a fraction of the shape's diagonal, or
// they are all the same place: without it the four deepest samples are four
// neighbouring cells in the middle of the widest blob.
const ANCHOR_SPACING_RATIO = 0.15;

// Places worth writing the name at, deepest inside the shape first. Depth is
// distance to the nearest border, so this ranks by elbow room. The centroid is
// wrong on its own for anything concave — a crescent's centroid sits in the
// bay, outside the territory, and the label would float on the map next to the
// shape it names.
function anchorCandidates(
  rings: LabelPoint[][],
  bounds: { minX: number; maxX: number; minY: number; maxY: number },
  centroid: LabelPoint,
): { point: LabelPoint; depth: number }[] {
  const scored: { point: LabelPoint; depth: number }[] = [];

  // The centroid competes directly rather than being approximated by whatever
  // grid sample happens to land near it.
  if (isInsideRings(centroid, rings)) {
    scored.push({ point: centroid, depth: distanceToRings(centroid, rings) });
  }

  const stepX = (bounds.maxX - bounds.minX) / ANCHOR_GRID;
  const stepY = (bounds.maxY - bounds.minY) / ANCHOR_GRID;

  for (let ix = 1; ix < ANCHOR_GRID; ix += 1) {
    for (let iy = 1; iy < ANCHOR_GRID; iy += 1) {
      const point = {
        x: bounds.minX + ix * stepX,
        y: bounds.minY + iy * stepY,
      };
      if (isInsideRings(point, rings)) {
        scored.push({ point, depth: distanceToRings(point, rings) });
      }
    }
  }

  scored.sort((a, b) => b.depth - a.depth);

  const spacing =
    Math.hypot(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) *
    ANCHOR_SPACING_RATIO;
  const chosen: { point: LabelPoint; depth: number }[] = [];

  for (const candidate of scored) {
    if (candidate.depth <= 0 || chosen.length === ANCHOR_CANDIDATES) {
      break;
    }
    const crowded = chosen.some(
      (kept) =>
        Math.hypot(
          kept.point.x - candidate.point.x,
          kept.point.y - candidate.point.y,
        ) < spacing,
    );
    if (!crowded) {
      chosen.push(candidate);
    }
  }

  return chosen;
}

// Fraction of the room a label may occupy, leaving a little air between the
// text and the territory's border.
const LABEL_FILL_RATIO = 0.9;
// Cap-height is well under the font size, so a line of text occupies less
// vertical room than its font size suggests. Sizing the height check by the
// full font size would reject labels that in fact fit comfortably.
const CAP_HEIGHT_RATIO = 0.72;
// Below the minimum the text is unreadable anyway, so a tiny territory gets no
// label at all rather than an illegible smudge. The maximum stops one huge
// continent from writing its name across the entire viewport.
const MIN_LABEL_PX = 9;
const MAX_LABEL_PX = 44;

// Labels come in as the map zooms in. Zoomed out, a screen full of territories
// is a screen full of names competing with the shapes; letting them sit faint
// until there is room for them keeps the map readable, and matches how they
// grow. Driven by the label's own pixel size rather than the zoom level, so it
// behaves the same under a custom map image (CRS.Simple), whose zoom numbers
// mean something entirely different.
const MIN_LABEL_OPACITY = 0.4;
// The size at which a label is fully opaque — comfortably readable, roughly
// twice the legibility floor.
const FULL_OPACITY_PX = 20;

// And labels go back out once you zoom past the territory. A shape several
// screens wide is no longer something you are orienting yourself against —
// you are looking at what's inside it — and its name stops being a label and
// becomes a word lying across the map. Measured against the viewport rather
// than a zoom level so it behaves the same on a custom map image, and so a
// small window hides them sooner than a maximised one, which is right: what
// matters is how much of the shape you can actually see.
const OVERSIZE_FADE_START = 1.2;
const OVERSIZE_HIDDEN = 2.5;

// Candidate angles for the text, and how finely the winner is then refined.
// Only 0..180 is searched: text at 200 degrees reads the same as at 20.
const COARSE_ANGLE_STEP_DEG = 15;
const FINE_ANGLE_STEP_DEG = 3;
// A rotated candidate has to beat the flattest one by this much to be worth
// tilting the text for. Set above sqrt(2) deliberately: a *square* fits about
// 41% more text along its diagonal, so any smaller threshold tilts the name on
// every blocky territory — which reads as a bug rather than as a fit. Shapes
// that genuinely run diagonally beat this by far more than a square can.
const TILT_MARGIN = 1.5;
// Refining the winning direction is a smaller claim than choosing it, so it
// asks for less than a tilt does — but not for nothing. A box tilted a few
// degrees inside a straight arm genuinely fits a hair more text, because its
// corners trade width against the arm's length; without a margin here the name
// ends up visibly askew in a rectangle to buy one percent of font size.
const REFINE_MARGIN = 1.05;

// Points sampled along each edge of the text box when testing whether it fits.
const BOX_EDGE_SAMPLES = 6;
// Bisection depth when growing the box. 12 halvings resolve a 44px range to
// under a hundredth of a pixel — far past what a font size needs.
const BISECTION_STEPS = 12;
// Ranking candidates only needs enough resolution to order them, and it runs
// once per (place, angle) pair, so it stops much earlier.
const RANKING_BISECTION_STEPS = 7;

export interface TerritoryLabelText {
  // Width of the whole string at font-size 1, from the real font.
  width: number;
  // Character count, for spreading leftover width between the letters.
  length: number;
}

export interface TerritoryLabelFit {
  center: MapPosition;
  // Screen-space rotation, kept within ±90° so text never reads upside down.
  angleDeg: number;
  fontSize: number;
  letterSpacing: number;
  opacity: number;
}

// Whether a text box of the given half-extents, centred on the anchor and
// rotated onto (cos, sin), lies inside the shape.
//
// This tests the box the glyphs actually occupy rather than measuring how far
// a ray travels before leaving the shape. A ray is the wrong instrument: cast
// perpendicular to a tilted baseline it reports the room at the *middle* of
// the text, while the corners at either end of the line stick out further and
// are what actually cross the border.
function boxFits(
  anchor: LabelPoint,
  cos: number,
  sin: number,
  halfWidth: number,
  halfHeight: number,
  rings: LabelPoint[][],
): boolean {
  const at = (along: number, across: number) => ({
    x: anchor.x + along * cos - across * sin,
    y: anchor.y + along * sin + across * cos,
  });

  for (let step = 0; step <= BOX_EDGE_SAMPLES; step += 1) {
    const t = -1 + (2 * step) / BOX_EDGE_SAMPLES;
    // Both long edges and both short ones; the corners fall out of t = ±1.
    if (
      !isInsideRings(at(t * halfWidth, -halfHeight), rings) ||
      !isInsideRings(at(t * halfWidth, halfHeight), rings) ||
      !isInsideRings(at(-halfWidth, t * halfHeight), rings) ||
      !isInsideRings(at(halfWidth, t * halfHeight), rings)
    ) {
      return false;
    }
  }

  return true;
}

// Largest value in [low, high] that still fits, assuming `low` does. Bisection
// rather than stepping: it converges in a fixed number of tests regardless of
// how big the shape is on screen.
function largestFitting(
  low: number,
  high: number,
  fits: (value: number) => boolean,
  steps: number = BISECTION_STEPS,
): number {
  let lower = low;
  let upper = high;
  for (let step = 0; step < steps; step += 1) {
    const middle = (lower + upper) / 2;
    if (fits(middle)) {
      lower = middle;
    } else {
      upper = middle;
    }
  }
  return lower;
}

// The biggest the text can be set at this angle, ignoring the legibility floor
// so candidate angles stay comparable to each other.
function fontSizeAt(
  anchor: LabelPoint,
  angleRad: number,
  rings: LabelPoint[][],
  textWidth: number,
  steps?: number,
): number {
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);

  return largestFitting(
    0,
    MAX_LABEL_PX,
    (fontSize) =>
      boxFits(
        anchor,
        cos,
        sin,
        (fontSize * textWidth) / (2 * LABEL_FILL_RATIO),
        (fontSize * CAP_HEIGHT_RATIO) / (2 * LABEL_FILL_RATIO),
        rings,
      ),
    steps,
  );
}

// How visible a label should be given how much bigger than the screen its
// territory has grown. 1 until the shape is a fifth again the viewport, then
// down to 0 as it passes two and a half times it.
function oversizeOpacity(
  shapeDiagonal: number,
  viewport?: { width: number; height: number },
): number {
  if (!viewport || viewport.width <= 0 || viewport.height <= 0) {
    return 1;
  }

  const ratio = shapeDiagonal / Math.hypot(viewport.width, viewport.height);
  if (ratio <= OVERSIZE_FADE_START) {
    return 1;
  }
  if (ratio >= OVERSIZE_HIDDEN) {
    return 0;
  }
  return (OVERSIZE_HIDDEN - ratio) / (OVERSIZE_HIDDEN - OVERSIZE_FADE_START);
}

// How the label is fitted to the shape, HOI4-style: the text runs along
// whichever direction gives it the most room and grows with the territory, so
// a wide province gets wide lettering and a small one gets small.
//
// The angle is *searched* rather than derived from the shape's principal axis.
// A PCA over the outline is biased by vertex density — an L-shaped territory
// with a finely-drawn diagonal edge tilts its label to match that edge rather
// than the body of the shape — and it optimises for the wrong thing anyway.
// What matters is where this particular string fits biggest, which is what
// each candidate angle is scored on directly.
//
// `text.width` is the label's width at font-size 1, measured by the caller
// against the real font. Estimating it from the character count is what let
// text overflow the shape: the estimate has to be exact, because the leftover
// width is then spent on letter-spacing, so any error lands outside the
// territory rather than being absorbed.
export function fitTerritoryLabel(
  rings: LabelPoint[][],
  toPosition: (point: LabelPoint) => MapPosition,
  text: TerritoryLabelText,
  // Omit, or pass a zero-sized one, to skip the zoomed-in-past-it rule — the
  // map has no measured size yet and every label would vanish.
  viewport?: { width: number; height: number },
): TerritoryLabelFit | null {
  const points = rings.flat();
  const textWidth = text.width;
  if (points.length === 0 || textWidth <= 0) {
    return null;
  }

  let sumX = 0;
  let sumY = 0;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const point of points) {
    sumX += point.x;
    sumY += point.y;
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minY = Math.min(minY, point.y);
    maxY = Math.max(maxY, point.y);
  }

  const candidates = anchorCandidates(
    rings,
    { minX, maxX, minY, maxY },
    { x: sumX / points.length, y: sumY / points.length },
  );
  if (candidates.length === 0) {
    // Nothing sampled inside — a sliver thinner than the grid, or a ring with
    // no area. There is no honest place to put a label.
    return null;
  }

  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

  // Text at 200 degrees reads the same as at 20; ±90 is the range that keeps
  // it right way up, and how flat an angle is means distance from 0 in it.
  const uprightDeg = (degrees: number) =>
    degrees > 90 ? degrees - 180 : degrees;

  // Angular distance between two directions, which wrap every 180 degrees:
  // 175 and 5 are ten degrees apart, not a hundred and seventy.
  function angleGap(a: number, b: number): number {
    const gap = Math.abs(a - b) % 180;
    return Math.min(gap, 180 - gap);
  }

  // Picks `prefer` when it comes within `margin` of the best angle, and the
  // best angle outright otherwise. The choice is deliberately binary: scoring
  // by "closest to preferred among everything within the margin" lets the
  // winner slide through the intermediate angles, so a vertical arm's label
  // settles at 75 degrees — a little flatter, and plainly wrong.
  function chooseAngle(
    anchor: LabelPoint,
    degreesToTry: number[],
    margin: number,
    prefer: number,
    steps?: number,
  ): { angleDeg: number; size: number } {
    const scored = degreesToTry.map((degrees) => ({
      degrees,
      size: fontSizeAt(anchor, toRadians(degrees), rings, textWidth, steps),
    }));

    let best = scored[0];
    let preferred: { degrees: number; size: number } | undefined;
    for (const entry of scored) {
      if (entry.size > best.size) {
        best = entry;
      }
      if (angleGap(entry.degrees, prefer) === 0) {
        preferred = entry;
      }
    }

    const chosen =
      preferred && preferred.size * margin >= best.size ? preferred : best;

    return { angleDeg: chosen.degrees, size: chosen.size };
  }

  const coarseAngles: number[] = [];
  for (let degrees = 0; degrees < 180; degrees += COARSE_ANGLE_STEP_DEG) {
    coarseAngles.push(degrees);
  }

  // Rank every (place, angle) pair together: the two choices aren't
  // independent, since the roomiest direction depends on where you stand.
  // Ranking runs at reduced bisection depth — it only has to order candidates,
  // and the winner is re-measured at full precision below.
  let best: { anchor: LabelPoint; angleDeg: number; size: number } | null =
    null;

  for (const candidate of candidates) {
    // Horizontal is what a tilt has to beat: text written across a blocky
    // territory at an angle reads as a mistake, so it has to buy real size.
    const { angleDeg, size } = chooseAngle(
      candidate.point,
      coarseAngles,
      TILT_MARGIN,
      0,
      RANKING_BISECTION_STEPS,
    );
    // Ties go to the earlier candidate, which is the one with more elbow room
    // — a better place to write from when the text fits either way.
    if (!best || size > best.size * REFINE_MARGIN) {
      best = { anchor: candidate.point, angleDeg, size };
    }
  }

  const anchor = best!.anchor;

  // Sharpen the winning direction, which is already settled. Same rule: only
  // move off it for a real gain, and prefer the flatter of equals.
  const fineAngles: number[] = [];
  for (
    let degrees = best!.angleDeg - COARSE_ANGLE_STEP_DEG + FINE_ANGLE_STEP_DEG;
    degrees < best!.angleDeg + COARSE_ANGLE_STEP_DEG;
    degrees += FINE_ANGLE_STEP_DEG
  ) {
    fineAngles.push(degrees);
  }
  // Refining prefers the direction already chosen, not horizontal: nudging a
  // vertical arm's label 12 degrees off vertical is "flatter" but plainly
  // worse, and that is exactly what preferring horizontal here would pick.
  const refined = chooseAngle(
    anchor,
    fineAngles,
    REFINE_MARGIN,
    best!.angleDeg,
  );

  const bestAngleDeg = refined.angleDeg;
  const bestSize = refined.size;

  const fontSize = bestSize;
  if (fontSize < MIN_LABEL_PX) {
    return null;
  }

  // Whatever width the text doesn't use is spent on letter-spacing, which is
  // what gives big territories that stretched, engraved-on-the-map look. The
  // stretch is grown against the same fit test, so a wider-than-natural line
  // still has to stay inside the shape.
  const angleRad = toRadians(bestAngleDeg);
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  const naturalWidth = fontSize * textWidth;
  const stretchedWidth = largestFitting(
    naturalWidth,
    Math.hypot(maxX - minX, maxY - minY),
    (width) =>
      boxFits(
        anchor,
        cos,
        sin,
        width / (2 * LABEL_FILL_RATIO),
        (fontSize * CAP_HEIGHT_RATIO) / (2 * LABEL_FILL_RATIO),
        rings,
      ),
  );

  // Only the gaps *between* characters count; CSS also adds one after the last
  // character, which the caller cancels with a negative margin.
  const gaps = Math.max(1, text.length - 1);
  const letterSpacing = Math.max(0, (stretchedWidth - naturalWidth) / gaps);

  const angleDeg = uprightDeg(bestAngleDeg);

  const grownIn =
    fontSize >= FULL_OPACITY_PX
      ? 1
      : MIN_LABEL_OPACITY +
        ((1 - MIN_LABEL_OPACITY) * (fontSize - MIN_LABEL_PX)) /
          (FULL_OPACITY_PX - MIN_LABEL_PX);

  const zoomedPast = oversizeOpacity(
    Math.hypot(maxX - minX, maxY - minY),
    viewport,
  );
  if (zoomedPast === 0) {
    return null;
  }

  // Whichever reason to be faint is stronger wins; they are independent, and a
  // label can be both small and half off the screen.
  const opacity = Math.min(grownIn, zoomedPast);

  return {
    center: toPosition(anchor),
    angleDeg,
    fontSize,
    letterSpacing,
    opacity,
  };
}
