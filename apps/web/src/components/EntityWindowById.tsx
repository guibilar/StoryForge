import { useQuery } from "urql";

import { EntityDocument } from "../gql/graphql";
import { formatGraphQLError } from "../lib/graphqlError";
import { useWindowChromeSync } from "../lib/WindowChromeContext";
import { EntityWindow } from "./EntityWindow";
import styles from "./EntityWindow.module.css";

export interface EntityWindowByIdProps {
  entityId: string;
  campaignId: string;
}

// EntityWindow takes a whole EntitySummary, which the opener normally
// already has in hand. A window restored after a reload has only the id
// recovered from its `entity:{id}` key, so this fetches the entity itself —
// the same shape NoteViewWindow already uses for notes.
export function EntityWindowById({
  entityId,
  campaignId,
}: EntityWindowByIdProps) {
  const [{ data, fetching, error }, reexecute] = useQuery({
    query: EntityDocument,
    variables: { id: entityId },
  });

  useWindowChromeSync(fetching, () =>
    reexecute({ requestPolicy: "network-only" }),
  );

  if (fetching) {
    return <p className={styles.empty}>Loading entity…</p>;
  }

  if (error) {
    return (
      <p className={styles.empty}>
        {formatGraphQLError(error) ?? "Unable to load this entity."}
      </p>
    );
  }

  if (!data?.entity) {
    return <p className={styles.empty}>This entity is no longer available.</p>;
  }

  return <EntityWindow entity={data.entity} campaignId={campaignId} />;
}
