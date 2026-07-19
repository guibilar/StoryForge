import { CampaignMember } from "@storyforge/domain";

/**
 * Raw target selection off the `forceSyncViewport` mutation's `input.target`
 * argument (KAN-129) — either "every player/observer in the campaign" or an
 * explicit list of userIds (e.g. a single targeted player).
 */
export interface ViewportSyncTarget {
  allPlayers: boolean;
  userIds: string[];
}

/**
 * Resolves a `forceSyncViewport` mutation's target selection down to a
 * concrete, deduplicated list of userIds to deliver the event to.
 *
 * There is no presence/online-tracking in this app (out of scope, see
 * KAN-129) — "all players" is therefore a static membership-list decision:
 * every `CampaignMember` with role `PLAYER` or `OBSERVER`, regardless of
 * whether they currently have a subscription open. A Storyteller/
 * Co-Storyteller/Owner is never an implicit target of "all players" — they
 * are the ones broadcasting.
 *
 * When explicit `userIds` are given instead, they're intersected with the
 * campaign's actual roster (any role) so a stale or mistyped id silently
 * drops rather than the mutation resolver trusting arbitrary caller input as
 * a delivery target.
 */
export function resolveViewportSyncTargets(
  members: CampaignMember[],
  target: ViewportSyncTarget,
): string[] {
  if (target.allPlayers) {
    return members
      .filter(
        (member) => member.Role === "PLAYER" || member.Role === "OBSERVER",
      )
      .map((member) => member.UserId.toString());
  }

  const rosterIds = new Set(members.map((member) => member.UserId.toString()));
  return Array.from(new Set(target.userIds)).filter((userId) =>
    rosterIds.has(userId),
  );
}
