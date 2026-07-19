import type { GraphQLContext } from "../../../../graphql/context";
import type { ForceSyncViewportPayload } from "../../../../graphql/pubsub";
import { toGraphQLError } from "../../../../graphql/errors";
import { requireCampaignMember } from "../../../campaignMembers/graphql/guards";

/**
 * `forceSyncViewport` (KAN-129) is published on a channel scoped only to
 * `campaignId` (per KAN-127's `[scopeId, payload]` pub/sub shape) — so every
 * subscribed client in the campaign receives every payload published on it,
 * regardless of who it's actually addressed to. This generator is the
 * per-subscriber filter that narrows that down: it re-wraps the campaign-
 * scoped source and only yields a payload whose `targetUserIds` (resolved by
 * the mutation resolver, see `Mutation.ts`) includes this specific
 * subscriber's userId. graphql-yoga/graphql-subscriptions ship no
 * `withFilter` helper (checked before writing this) — a plain wrapping
 * async generator does the same job.
 */
async function* forceSyncViewportSource(
  context: GraphQLContext,
  campaignId: string,
  subscriberUserId: string,
): AsyncGenerator<ForceSyncViewportPayload> {
  for await (const payload of context.pubSub.subscribe(
    "forceSyncViewport",
    campaignId,
  )) {
    if (payload.targetUserIds.includes(subscriberUserId)) {
      yield payload;
    }
  }
}

export const Subscription = {
  forceSyncViewport: {
    subscribe: async (
      _parent: unknown,
      args: { campaignId: string },
      context: GraphQLContext,
    ) => {
      try {
        // Any campaign member may subscribe — BROADCAST_TO_PLAYERS only
        // gates who can *trigger* the mutation, not who can listen. A
        // subscriber who's never actually targeted simply never receives
        // anything, filtered out above.
        const membership = await requireCampaignMember(
          context,
          args.campaignId,
        );

        return forceSyncViewportSource(
          context,
          args.campaignId,
          membership.UserId.toString(),
        );
      } catch (error) {
        toGraphQLError(error);
      }
    },
    resolve: (payload: ForceSyncViewportPayload) => ({
      campaignId: payload.campaignId,
      center: payload.center,
      zoom: payload.zoom,
      broadcasterId: payload.broadcasterId,
    }),
  },
};
