import { useEffect } from "react";
import { useSubscription } from "urql";

import { OnEntityWindowForceOpenedDocument } from "../gql/graphql";
import { useOpenEntityWindow } from "../hooks/useOpenEntityWindow";

export interface ForceOpenEntityListenerProps {
  campaignId: string;
}

// KAN-133 side A: listens for a Storyteller's forceOpenEntityWindow
// broadcast (KAN-132) and opens the entity's window on this client, using
// the same useOpenEntityWindow every other entity-opening callsite goes
// through (EntitySidebar, EntityWindow's Relationships tab,
// RelationshipGraphWindow). Mounted once per campaign inside
// DesktopWindowsContext.Provider (CampaignDesktopPage, alongside
// AppCommandPalette) so it's always active regardless of which window
// currently has focus — same "always mounted" placement as
// useWorkspaceStateSync.
//
// No role gate: the server-side subscription resolver only ever delivers a
// payload to a client the Storyteller actually targeted (allPlayers or a
// specific userId, KAN-132), so every campaign member subscribes
// unconditionally and renders whatever arrives without re-checking
// visibility client-side, per KAN-132/KAN-131's documented exception.
export function ForceOpenEntityListener({
  campaignId,
}: ForceOpenEntityListenerProps) {
  const openEntityWindow = useOpenEntityWindow(campaignId);
  const [{ data }] = useSubscription({
    query: OnEntityWindowForceOpenedDocument,
    variables: { campaignId },
    pause: !campaignId,
  });

  const entity = data?.entityWindowForceOpened;

  useEffect(() => {
    if (entity) {
      openEntityWindow(entity);
    }
    // openEntityWindow is re-created every render (not memoized) and is
    // derived entirely from campaignId/context — only a genuinely new
    // subscription payload (a new `entity` object reference, per urql's
    // useSubscription semantics — see MapsWindow's identical comment) should
    // re-trigger this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entity]);

  return null;
}
