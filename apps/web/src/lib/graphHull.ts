// Blob outlines for the relationship graph's clusters. Drawing a rectangle
// round a group is easy but reads as a container the nodes were placed in;
// a hull that follows wherever the members actually ended up reads as a
// description of them, which is what a derived cluster is.

export interface HullPoint {
  x: number;
  y: number;
}

// Sampled around every member so the hull is rounded and non-degenerate for
// free — a group of one becomes a circle, a group of two a capsule, without
// any of those being special cases in the hull code itself.
const SAMPLES = 12;

function expand(points: HullPoint[], padding: number): HullPoint[] {
  const expanded: HullPoint[] = [];
  for (const point of points) {
    for (let step = 0; step < SAMPLES; step += 1) {
      const angle = (2 * Math.PI * step) / SAMPLES;
      expanded.push({
        x: point.x + padding * Math.cos(angle),
        y: point.y + padding * Math.sin(angle),
      });
    }
  }
  return expanded;
}

function cross(o: HullPoint, a: HullPoint, b: HullPoint): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

// Andrew's monotone chain: sort by x (then y), sweep once for the lower hull
// and once for the upper, dropping any vertex that turns the wrong way.
function convexHull(points: HullPoint[]): HullPoint[] {
  if (points.length < 3) {
    return points;
  }

  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const half = (source: HullPoint[]): HullPoint[] => {
    const chain: HullPoint[] = [];
    for (const point of source) {
      while (
        chain.length >= 2 &&
        cross(chain[chain.length - 2], chain[chain.length - 1], point) <= 0
      ) {
        chain.pop();
      }
      chain.push(point);
    }
    chain.pop();
    return chain;
  };

  return [...half(sorted), ...half([...sorted].reverse())];
}

function midpoint(a: HullPoint, b: HullPoint): HullPoint {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/**
 * An SVG path enclosing every point with `padding` clearance, smoothed into a
 * blob. Returns null when there's nothing to enclose.
 */
export function hullPath(points: HullPoint[], padding: number): string | null {
  if (points.length === 0) {
    return null;
  }

  const hull = convexHull(expand(points, padding));
  if (hull.length < 3) {
    return null;
  }

  // Each hull vertex becomes the control point of a quadratic through the
  // midpoints of its two edges, which rounds every corner by construction.
  const start = midpoint(hull[hull.length - 1], hull[0]);
  const segments = hull.map((vertex, index) => {
    const next = midpoint(vertex, hull[(index + 1) % hull.length]);
    return `Q ${vertex.x.toFixed(1)} ${vertex.y.toFixed(1)} ${next.x.toFixed(1)} ${next.y.toFixed(1)}`;
  });

  return `M ${start.x.toFixed(1)} ${start.y.toFixed(1)} ${segments.join(" ")} Z`;
}

/** Bounding box of a set of points, for placing a cluster's label. */
export function boundsOf(points: HullPoint[]) {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}
