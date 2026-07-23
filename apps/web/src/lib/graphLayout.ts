// The relationship graph used to drop every entity on one fixed-radius circle
// in query order (KAN-42), which put unrelated entities next to each other and
// ran every edge straight through the middle of the ring. These layouts place
// nodes by their connections instead, so distance on screen means something.

export type GraphLayoutKind = "force" | "type" | "circle" | "grid";

export interface GraphLayoutNode {
  id: string;
  /** Used by the "type" layout to cluster nodes; ignored by the others. */
  group: string;
}

export interface GraphLayoutLink {
  source: string;
  target: string;
}

export interface GraphPoint {
  x: number;
  y: number;
}

export type GraphPositions = Map<string, GraphPoint>;

// Roughly the on-screen distance we want between two connected nodes: wide
// enough that a node's name and the edge's type label don't collide.
const LINK_DISTANCE = 230;
const ITERATIONS = 400;
// Without this every disconnected component drifts apart forever, since
// nothing but repulsion acts on it.
const GRAVITY = 0.06;

// Deterministic, so re-rendering (a refetch, a theme flip) doesn't reshuffle
// the graph under the user. Math.random would.
function seededOffset(id: string): number {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) | 0;
  }
  return (Math.abs(hash) % 1000) / 1000;
}

function circlePoints(count: number, radius: number): GraphPoint[] {
  return Array.from({ length: count }, (_value, index) => {
    const angle = (2 * Math.PI * index) / Math.max(count, 1);
    return { x: radius * Math.cos(angle), y: radius * Math.sin(angle) };
  });
}

// A ring that grows with the node count — a fixed radius is exactly what made
// the old layout overlap once a campaign had more than a handful of entities.
function radiusFor(count: number): number {
  return Math.max(240, (count * LINK_DISTANCE * 0.55) / Math.PI);
}

function circleLayout(nodes: GraphLayoutNode[]): GraphPositions {
  const points = circlePoints(nodes.length, radiusFor(nodes.length));
  return new Map(nodes.map((node, index) => [node.id, points[index]]));
}

function gridLayout(nodes: GraphLayoutNode[]): GraphPositions {
  const columns = Math.max(1, Math.ceil(Math.sqrt(nodes.length)));
  const rows = Math.ceil(nodes.length / columns);
  return new Map(
    nodes.map((node, index) => [
      node.id,
      {
        x: ((index % columns) - (columns - 1) / 2) * 210,
        y: (Math.floor(index / columns) - (rows - 1) / 2) * 190,
      },
    ]),
  );
}

// Clans in one cluster, districts in another: answers "who belongs to what"
// at a glance, which the connection-driven layouts deliberately don't encode.
function typeLayout(nodes: GraphLayoutNode[]): GraphPositions {
  const groups = new Map<string, GraphLayoutNode[]>();
  for (const node of nodes) {
    const bucket = groups.get(node.group);
    if (bucket) {
      bucket.push(node);
    } else {
      groups.set(node.group, [node]);
    }
  }

  const positions: GraphPositions = new Map();
  const centers = circlePoints(
    groups.size,
    // One group is just a circle of its own members, so don't push it out.
    groups.size === 1 ? 0 : radiusFor(nodes.length) * 1.15,
  );

  let groupIndex = 0;
  for (const members of groups.values()) {
    const center = centers[groupIndex];
    const inner =
      members.length === 1
        ? [{ x: 0, y: 0 }]
        : circlePoints(
            members.length,
            Math.max(110, (members.length * 150) / (2 * Math.PI)),
          );
    members.forEach((member, index) => {
      positions.set(member.id, {
        x: center.x + inner[index].x,
        y: center.y + inner[index].y,
      });
    });
    groupIndex += 1;
  }

  return positions;
}

// Fruchterman-Reingold: every pair of nodes pushes apart (k²/d), every edge
// pulls together (d²/k), and a falling "temperature" caps how far a node may
// move per pass so the whole thing settles instead of oscillating. Run to
// completion synchronously — a few hundred passes over a campaign's worth of
// entities is well under a frame, and a live ticking simulation would fight
// the user dragging nodes around.
function forceLayout(
  nodes: GraphLayoutNode[],
  links: GraphLayoutLink[],
): GraphPositions {
  const count = nodes.length;
  const indexOf = new Map(nodes.map((node, index) => [node.id, index]));
  // Seeded jitter breaks the symmetry of a perfect ring, which otherwise has
  // no direction to relax in and leaves the layout looking like the old one.
  const start = circlePoints(count, radiusFor(count));
  const x = start.map(
    (point, index) => point.x + seededOffset(nodes[index].id) * 40,
  );
  const y = start.map(
    (point, index) => point.y + seededOffset(nodes[index].id) * 40,
  );

  const edges = links
    .map((link) => [indexOf.get(link.source), indexOf.get(link.target)])
    .filter(
      (pair): pair is [number, number] =>
        pair[0] !== undefined && pair[1] !== undefined && pair[0] !== pair[1],
    );

  const k = LINK_DISTANCE;
  let temperature = k;
  const cooling = temperature / (ITERATIONS + 1);

  const dispX = new Array<number>(count).fill(0);
  const dispY = new Array<number>(count).fill(0);

  for (let pass = 0; pass < ITERATIONS; pass += 1) {
    dispX.fill(0);
    dispY.fill(0);

    for (let a = 0; a < count; a += 1) {
      for (let b = a + 1; b < count; b += 1) {
        const dx = x[a] - x[b];
        const dy = y[a] - y[b];
        const distance = Math.max(Math.hypot(dx, dy), 0.01);
        const force = (k * k) / distance;
        const ux = (dx / distance) * force;
        const uy = (dy / distance) * force;
        dispX[a] += ux;
        dispY[a] += uy;
        dispX[b] -= ux;
        dispY[b] -= uy;
      }
    }

    for (const [a, b] of edges) {
      const dx = x[a] - x[b];
      const dy = y[a] - y[b];
      const distance = Math.max(Math.hypot(dx, dy), 0.01);
      const force = (distance * distance) / k;
      const ux = (dx / distance) * force;
      const uy = (dy / distance) * force;
      dispX[a] -= ux;
      dispY[a] -= uy;
      dispX[b] += ux;
      dispY[b] += uy;
    }

    for (let index = 0; index < count; index += 1) {
      dispX[index] -= x[index] * GRAVITY * k * 0.01;
      dispY[index] -= y[index] * GRAVITY * k * 0.01;

      const length = Math.max(Math.hypot(dispX[index], dispY[index]), 0.01);
      const step = Math.min(length, temperature);
      x[index] += (dispX[index] / length) * step;
      y[index] += (dispY[index] / length) * step;
    }

    temperature -= cooling;
  }

  return new Map(
    nodes.map((node, index) => [node.id, { x: x[index], y: y[index] }]),
  );
}

/**
 * How far each edge should bow off the straight line between its endpoints, so
 * that several relationships between the same two entities don't all route
 * along one curve with their labels printed on top of each other.
 *
 * Offsets are centred on zero: a lone edge stays straight, a pair bows
 * symmetrically either side, three put one down the middle. Pairs are treated
 * as unordered — A->B and B->A join the same two nodes on screen.
 */
export function parallelEdgeOffsets(
  links: ReadonlyArray<{ id: string; source: string; target: string }>,
  gap: number,
): Map<string, number> {
  const byPair = new Map<string, string[]>();
  for (const link of links) {
    const key = [link.source, link.target].sort().join(" ");
    const bucket = byPair.get(key);
    if (bucket) {
      bucket.push(link.id);
    } else {
      byPair.set(key, [link.id]);
    }
  }

  const offsets = new Map<string, number>();
  for (const ids of byPair.values()) {
    for (const [index, id] of ids.entries()) {
      offsets.set(id, (index - (ids.length - 1) / 2) * gap);
    }
  }
  return offsets;
}

export function layoutGraph(
  kind: GraphLayoutKind,
  nodes: GraphLayoutNode[],
  links: GraphLayoutLink[],
): GraphPositions {
  switch (kind) {
    case "circle":
      return circleLayout(nodes);
    case "grid":
      return gridLayout(nodes);
    case "type":
      return typeLayout(nodes);
    default:
      return forceLayout(nodes, links);
  }
}
