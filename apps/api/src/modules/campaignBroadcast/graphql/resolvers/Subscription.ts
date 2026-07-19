import type { GraphQLContext } from "../../../../graphql/context";
import type { CampaignBroadcastPayload } from "../../../../graphql/pubsub";
import { toGraphQLError } from "../../../../graphql/errors";
import { requireCampaignMember } from "../../../campaignMembers/graphql/guards";

/**
 * How often the trivial proof-of-concept channel pushes a heartbeat while a
 * client stays subscribed. This is transport-proof plumbing only — feature
 * tickets (KAN-129, KAN-132) publish their own payloads on their own
 * channels whenever the underlying domain event actually happens, they do
 * not need to poll on an interval like this.
 */
export const CAMPAIGN_BROADCAST_PING_INTERVAL_MS = 15_000;

async function* campaignBroadcastSource(
  context: GraphQLContext,
  campaignId: string,
): AsyncGenerator<CampaignBroadcastPayload> {
  const timer = setInterval(() => {
    context.pubSub.publish("campaignBroadcast", campaignId, {
      message: "ping",
      emittedAt: new Date().toISOString(),
    });
  }, CAMPAIGN_BROADCAST_PING_INTERVAL_MS);

  try {
    yield* context.pubSub.subscribe("campaignBroadcast", campaignId);
  } finally {
    clearInterval(timer);
  }
}

export const Subscription = {
  campaignBroadcast: {
    subscribe: async (
      _parent: unknown,
      args: { campaignId: string },
      context: GraphQLContext,
    ) => {
      try {
        await requireCampaignMember(context, args.campaignId);
      } catch (error) {
        toGraphQLError(error);
      }

      return campaignBroadcastSource(context, args.campaignId);
    },
    resolve: (payload: CampaignBroadcastPayload) => payload,
  },
};
