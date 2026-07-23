import { useState } from "react";
import { useMutation } from "urql";
import { Button, FormError } from "@storyforge/ui";

import { ForceOpenEntityWindowDocument } from "../gql/graphql";
import { formatGraphQLError } from "../lib/graphqlError";
import { ALL_PLAYERS_TARGET } from "../lib/broadcastTarget";
import type {
  BroadcastableMember,
  BroadcastTarget,
} from "../lib/broadcastTarget";
import { BroadcastTargetPicker } from "./BroadcastTargetPicker";
import styles from "./ForceOpenEntityAction.module.css";

export interface ForceOpenEntityActionProps {
  campaignId: string;
  entityId: string;
  members: BroadcastableMember[];
  // Distinguishes this instance's picker id/aria-label when several are
  // rendered at once (one per open entity window).
  idPrefix: string;
}

// Storyteller-tier "push this entity's window onto a player's screen"
// trigger (KAN-133 side B). Reuses KAN-131's BroadcastTargetPicker and
// mirrors MapsWindow's toggle + confirm + success/error message pattern.
// Lives in EntityWindow's Overview tab only — it was also rendered per row
// in the old entity sidebar, but the inline picker panel doesn't fit a
// narrow nav column and duplicated the window control. Callers are responsible for
// only rendering this for a
// Storyteller-tier role (OWNER/STORYTELLER/CO_STORYTELLER) — it does not
// gate itself.
export function ForceOpenEntityAction({
  campaignId,
  entityId,
  members,
  idPrefix,
}: ForceOpenEntityActionProps) {
  const [expanded, setExpanded] = useState(false);
  const [target, setTarget] = useState<BroadcastTarget>(ALL_PLAYERS_TARGET);
  const [sent, setSent] = useState(false);
  const [state, forceOpenEntityWindow] = useMutation(
    ForceOpenEntityWindowDocument,
  );

  function openPanel() {
    setSent(false);
    setExpanded(true);
  }

  function closePanel() {
    setExpanded(false);
  }

  async function handleSend() {
    setSent(false);
    const result = await forceOpenEntityWindow({
      input: { campaignId, entityId, target },
    });
    if (result.data?.forceOpenEntityWindow) {
      setSent(true);
    }
  }

  if (!expanded) {
    return (
      <Button type="button" variant="secondary" onClick={openPanel}>
        Open for player(s)…
      </Button>
    );
  }

  const actionError = formatGraphQLError(state.error);

  return (
    <div className={styles.panel}>
      <BroadcastTargetPicker
        id={`${idPrefix}-force-open-target`}
        aria-label="Open for player(s) target"
        members={members}
        value={target}
        onChange={setTarget}
        disabled={state.fetching}
      />
      <Button type="button" disabled={state.fetching} onClick={handleSend}>
        Send
      </Button>
      <Button type="button" variant="secondary" onClick={closePanel}>
        Cancel
      </Button>
      {sent ? <span className={styles.success}>Opened.</span> : null}
      {actionError ? <FormError>{actionError}</FormError> : null}
    </div>
  );
}
