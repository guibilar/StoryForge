import { useMemo } from "react";
import { ViewportPortal } from "@xyflow/react";

import { boundsOf, hullPath, type HullPoint } from "../lib/graphHull";
import styles from "./GraphClusterLayer.module.css";

export interface GraphCluster {
  id: string;
  label: string;
  color: string;
  /** Centre of every node the cluster encloses, in flow coordinates. */
  points: HullPoint[];
  memberCount: number;
}

// Wide enough to clear a portrait (156px node box) plus breathing room, so a
// member never touches the outline it's inside.
const HULL_PADDING = 96;
const LABEL_GAP = 22;

// Drawn through ViewportPortal so the hulls live in flow coordinates and pan
// and zoom with the graph for free. z-index -1 keeps them under the edges and
// nodes — a cluster is a backdrop, not something you click.
export function GraphClusterLayer({ clusters }: { clusters: GraphCluster[] }) {
  const shapes = useMemo(
    () =>
      clusters
        .map((cluster) => {
          const path = hullPath(cluster.points, HULL_PADDING);
          if (!path) {
            return null;
          }
          const bounds = boundsOf(cluster.points);
          return {
            ...cluster,
            path,
            labelX: (bounds.minX + bounds.maxX) / 2,
            labelY: bounds.minY - HULL_PADDING - LABEL_GAP,
          };
        })
        .filter((shape) => shape !== null),
    [clusters],
  );

  if (shapes.length === 0) {
    return null;
  }

  return (
    <ViewportPortal>
      <div className={styles.layer}>
        {/* Sized 0x0 with overflow visible: the paths carry their own flow
            coordinates, so the <svg> only needs to establish an origin. */}
        <svg className={styles.canvas} width={0} height={0}>
          {shapes.map((shape) => (
            <g key={shape.id}>
              <path
                className={styles.hull}
                d={shape.path}
                style={{ stroke: shape.color, fill: shape.color }}
              />
              <text
                className={styles.label}
                x={shape.labelX}
                y={shape.labelY}
                textAnchor="middle"
              >
                {shape.label}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </ViewportPortal>
  );
}
