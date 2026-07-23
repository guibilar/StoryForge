import { memo } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";

import { resolveUploadUrl } from "../lib/apiOrigin";
import styles from "./EntityGraphNode.module.css";

export interface EntityGraphNodeData extends Record<string, unknown> {
  name: string;
  type: string;
  image?: string | null;
  color: string;
  /** Portrait diameter in px — scaled by how connected the entity is. */
  size: number;
  dimmed: boolean;
  focused: boolean;
  // Stands in for the hidden side of a concealed-endpoint relationship
  // (KAN-134) rather than for a real entity: no portrait to show, nothing to
  // open on click, and drawn so it reads as "someone, identity withheld".
  concealed?: boolean;
}

export type EntityGraphNodeType = Node<EntityGraphNodeData, "entity">;

// Each of the four sides carries both a source and a target handle. The edge
// builder picks whichever side faces the other node, which is what keeps the
// arrow landing on the near rim of the portrait instead of looping around it.
const SIDES = [
  { id: "top", position: Position.Top, className: styles.handleTop },
  { id: "right", position: Position.Right, className: styles.handleRight },
  { id: "bottom", position: Position.Bottom, className: styles.handleBottom },
  { id: "left", position: Position.Left, className: styles.handleLeft },
] as const;

export type EntityGraphSide = (typeof SIDES)[number]["id"];

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

function EntityGraphNodeComponent({ data }: NodeProps<EntityGraphNodeType>) {
  const classNames = [
    styles.node,
    data.dimmed ? styles.dimmed : "",
    data.focused ? styles.focused : "",
    data.concealed ? styles.concealed : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={classNames}
      style={
        {
          "--node-color": data.color,
          "--avatar-size": `${data.size}px`,
        } as React.CSSProperties
      }
    >
      {SIDES.map((side) => (
        <Handle
          key={`t-${side.id}`}
          type="target"
          id={`t-${side.id}`}
          position={side.position}
          className={`${styles.handle} ${side.className}`}
          isConnectable={false}
        />
      ))}
      <div className={styles.avatar}>
        {data.concealed ? (
          <span className={styles.initials} aria-hidden="true">
            ?
          </span>
        ) : data.image ? (
          <img
            className={styles.portrait}
            src={resolveUploadUrl(data.image)}
            alt=""
          />
        ) : (
          <span className={styles.initials}>{initialsOf(data.name)}</span>
        )}
      </div>
      <span className={styles.name}>{data.name}</span>
      <span className={styles.type}>{data.type}</span>
      {SIDES.map((side) => (
        <Handle
          key={`s-${side.id}`}
          type="source"
          id={`s-${side.id}`}
          position={side.position}
          className={`${styles.handle} ${side.className}`}
          isConnectable={false}
        />
      ))}
    </div>
  );
}

export const EntityGraphNode = memo(EntityGraphNodeComponent);

export type ClusterAnchorNodeType = Node<
  Record<string, never>,
  "clusterAnchor"
>;

// An organization that became a cluster boundary stops being a node, but it
// keeps its own relationships (the Camarilla still opposes the Anarchs). This
// is what those edges attach to: a zero-size, invisible point at the centre of
// the hull, so a cluster-to-cluster link has somewhere to land.
function ClusterAnchorNodeComponent() {
  return (
    <div className={styles.anchor}>
      {SIDES.map((side) => (
        <Handle
          key={`t-${side.id}`}
          type="target"
          id={`t-${side.id}`}
          position={side.position}
          className={styles.handle}
          isConnectable={false}
        />
      ))}
      {SIDES.map((side) => (
        <Handle
          key={`s-${side.id}`}
          type="source"
          id={`s-${side.id}`}
          position={side.position}
          className={styles.handle}
          isConnectable={false}
        />
      ))}
    </div>
  );
}

export const ClusterAnchorNode = memo(ClusterAnchorNodeComponent);
