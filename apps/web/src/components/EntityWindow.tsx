import type { EntityVisibility } from "../gql/graphql";
import styles from "./EntityWindow.module.css";

export interface EntitySummary {
  id: string;
  name: string;
  type: string;
  description?: string | null;
  visibility: EntityVisibility;
}

export interface EntityWindowProps {
  entity: EntitySummary;
}

// Minimal seed for the dynamic entity:{id} window opened from EntitySidebar
// (KAN-96). KAN-97 adds Overview/Relationships/Notes tabs on top of this —
// this is deliberately just the Overview content for now.
export function EntityWindow({ entity }: EntityWindowProps) {
  return (
    <div className={styles.wrap}>
      <span className={styles.type}>{entity.type}</span>
      <h2 className={styles.name}>{entity.name}</h2>
      <span className={styles.visibility}>{entity.visibility}</span>
      {entity.description ? (
        <p className={styles.description}>{entity.description}</p>
      ) : (
        <p className={styles.empty}>No description yet.</p>
      )}
    </div>
  );
}
