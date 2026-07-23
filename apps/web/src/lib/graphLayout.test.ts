import { describe, expect, it } from "vitest";

import {
  layoutGraph,
  parallelEdgeOffsets,
  type GraphLayoutNode,
} from "./graphLayout";

function nodes(...ids: Array<[string, string]>): GraphLayoutNode[] {
  return ids.map(([id, group]) => ({ id, group }));
}

const CHAIN = nodes(
  ["a", "npc"],
  ["b", "npc"],
  ["c", "clan"],
  ["d", "clan"],
  ["e", "city"],
);

const LINKS = [
  { source: "a", target: "b" },
  { source: "b", target: "c" },
  { source: "c", target: "d" },
];

function minimumSeparation(positions: Map<string, { x: number; y: number }>) {
  const points = [...positions.values()];
  let min = Infinity;
  for (let a = 0; a < points.length; a += 1) {
    for (let b = a + 1; b < points.length; b += 1) {
      min = Math.min(
        min,
        Math.hypot(points[a].x - points[b].x, points[a].y - points[b].y),
      );
    }
  }
  return min;
}

describe("layoutGraph", () => {
  it("positions every node exactly once for each layout", () => {
    for (const kind of ["force", "type", "circle", "grid"] as const) {
      const positions = layoutGraph(kind, CHAIN, LINKS);
      expect([...positions.keys()].sort()).toEqual(["a", "b", "c", "d", "e"]);
    }
  });

  it("is deterministic, so a refetch doesn't reshuffle the graph", () => {
    const first = layoutGraph("force", CHAIN, LINKS);
    const second = layoutGraph("force", CHAIN, LINKS);

    for (const [id, point] of first) {
      expect(second.get(id)).toEqual(point);
    }
  });

  it("keeps nodes apart — the overlap the fixed-radius circle produced", () => {
    // 24 entities is where the old single 220px ring started stacking labels
    // on top of each other.
    const many = nodes(
      ...Array.from(
        { length: 24 },
        (_value, index) =>
          [`n${index}`, `type${index % 4}`] as [string, string],
      ),
    );

    expect(
      minimumSeparation(layoutGraph("force", many, LINKS)),
    ).toBeGreaterThan(80);
    expect(minimumSeparation(layoutGraph("circle", many, []))).toBeGreaterThan(
      80,
    );
    expect(minimumSeparation(layoutGraph("grid", many, []))).toBeGreaterThan(
      80,
    );
  });

  it("pulls connected nodes closer than unconnected ones", () => {
    const positions = layoutGraph("force", CHAIN, LINKS);
    const distance = (from: string, to: string) => {
      const a = positions.get(from)!;
      const b = positions.get(to)!;
      return Math.hypot(a.x - b.x, a.y - b.y);
    };

    // "e" is isolated; a and b share an edge.
    expect(distance("a", "b")).toBeLessThan(distance("a", "e"));
  });

  it("clusters same-type entities in the type layout", () => {
    const positions = layoutGraph(
      "type",
      nodes(["a", "npc"], ["b", "npc"], ["c", "clan"], ["d", "clan"]),
      [],
    );
    const distance = (from: string, to: string) => {
      const a = positions.get(from)!;
      const b = positions.get(to)!;
      return Math.hypot(a.x - b.x, a.y - b.y);
    };

    expect(distance("a", "b")).toBeLessThan(distance("a", "c"));
  });

  it("handles an empty graph and a single node", () => {
    expect(layoutGraph("force", [], []).size).toBe(0);
    expect(layoutGraph("force", nodes(["solo", "npc"]), []).size).toBe(1);
    expect(layoutGraph("type", nodes(["solo", "npc"]), []).get("solo")).toEqual(
      {
        x: 0,
        y: 0,
      },
    );
  });
});

// Two entities can hold several relationships at once. Routed identically they
// stack, printing one label over the other ("E[ RESENTS ]Y").
describe("parallelEdgeOffsets", () => {
  it("leaves a lone edge straight", () => {
    const offsets = parallelEdgeOffsets(
      [{ id: "r1", source: "a", target: "b" }],
      40,
    );

    expect(offsets.get("r1")).toBe(0);
  });

  it("bows a pair symmetrically either side of the line", () => {
    const offsets = parallelEdgeOffsets(
      [
        { id: "r1", source: "a", target: "b" },
        { id: "r2", source: "a", target: "b" },
      ],
      40,
    );

    expect(offsets.get("r1")).toBe(-20);
    expect(offsets.get("r2")).toBe(20);
  });

  it("puts the middle one of three straight down the line", () => {
    const offsets = parallelEdgeOffsets(
      [
        { id: "r1", source: "a", target: "b" },
        { id: "r2", source: "a", target: "b" },
        { id: "r3", source: "a", target: "b" },
      ],
      40,
    );

    expect([...offsets.values()]).toEqual([-40, 0, 40]);
  });

  it("treats a reversed edge as the same pair of nodes", () => {
    const offsets = parallelEdgeOffsets(
      [
        { id: "r1", source: "a", target: "b" },
        // Drawn between the same two portraits, so it still has to be fanned.
        { id: "r2", source: "b", target: "a" },
      ],
      40,
    );

    expect(offsets.get("r1")).not.toBe(offsets.get("r2"));
  });

  it("keeps unrelated pairs independent", () => {
    const offsets = parallelEdgeOffsets(
      [
        { id: "r1", source: "a", target: "b" },
        { id: "r2", source: "c", target: "d" },
      ],
      40,
    );

    expect(offsets.get("r1")).toBe(0);
    expect(offsets.get("r2")).toBe(0);
  });
});
