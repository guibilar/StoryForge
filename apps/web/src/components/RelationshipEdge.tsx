import { memo } from "react";
import { BaseEdge, EdgeLabelRenderer, type EdgeProps } from "@xyflow/react";

import styles from "./RelationshipEdge.module.css";

export interface RelationshipEdgeData extends Record<string, unknown> {
  label: string;
  color: string;
  /** Perpendicular bow, in px. Fans parallel edges apart; 0 draws straight. */
  offset: number;
  concealed: boolean;
  /** False while another node is hovered and this edge isn't part of it. */
  connected: boolean;
  /** True when one endpoint is the hovered node. */
  active: boolean;
  onSelect?: () => void;
}

// Two entities can have any number of relationships (an Enemy *and* a Resents),
// and every built-in edge type routes them along the identical curve — the
// second edge and its label land exactly on top of the first. Each edge here
// bows by its own `offset` instead, so a pair fans symmetrically and each
// label sits at its own curve's midpoint.
function RelationshipEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  data,
  markerEnd,
  style,
}: EdgeProps) {
  const {
    label,
    offset = 0,
    connected = true,
    active = false,
    onSelect,
  } = (data ?? {}) as RelationshipEdgeData;

  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  // Guards a zero-length span (two nodes stacked, or a self-link) from
  // producing NaNs in the normal.
  const length = Math.max(Math.hypot(dx, dy), 0.01);
  const normalX = -dy / length;
  const normalY = dx / length;

  // Quadratic control point: the midpoint pushed out along the normal. At
  // offset 0 it sits on the line, which renders as a straight edge.
  const controlX = (sourceX + targetX) / 2 + normalX * offset;
  const controlY = (sourceY + targetY) / 2 + normalY * offset;

  const path = `M ${sourceX},${sourceY} Q ${controlX},${controlY} ${targetX},${targetY}`;

  // The curve's own midpoint (t=0.5 of a quadratic), not the chord's — on a
  // bowed edge those are different places, and the label belongs on the curve.
  const labelX = (sourceX + 2 * controlX + targetX) / 4;
  const labelY = (sourceY + 2 * controlY + targetY) / 4;

  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} style={style} />
      <EdgeLabelRenderer>
        <button
          type="button"
          className={[
            styles.label,
            connected ? "" : styles.faded,
            active ? styles.active : "",
          ]
            .filter(Boolean)
            .join(" ")}
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            borderColor: (data as RelationshipEdgeData | undefined)?.color,
          }}
          // A far bigger click target than a 1.4px line, which is what made
          // editing a relationship from the graph so fiddly.
          onClick={onSelect}
          disabled={!onSelect}
        >
          {label}
        </button>
      </EdgeLabelRenderer>
    </>
  );
}

export const RelationshipEdge = memo(RelationshipEdgeComponent);
