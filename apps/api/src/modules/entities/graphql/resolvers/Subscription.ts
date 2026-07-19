import type { Entity } from "@storyforge/domain";
import type { GraphQLContext } from "../../../../graphql/context";
import { toGraphQLError } from "../../../../graphql/errors";
import { requireCampaignMember } from "../../../campaignMembers/graphql/guards";

/**
 * Filters the campaign-scoped `entityWindowForceOpened` channel down to
 * events actually targeted at `currentUserId`. The pub/sub channel itself
 * only scopes by campaign (see `graphql/pubsub.ts`), so per-subscriber
 * targeting has to happen here — broadcasting campaign-wide and filtering
 * client-side would leak entity data (including PRIVATE/STORYTELLER ones,
 * per KAN-132's intentional visibility bypass) to every campaign member,
 * not just the Storyteller's chosen targets. No `withFilter`-style helper
 * exists in this codebase's dependencies (`graphql-yoga`/`graphql` only —
 * no `graphql-subscriptions`), hence the manual wrapper below rather than
 * pulling in a new dependency for it.
 */
async function* entityWindowForceOpenedSource(
  context: GraphQLContext,
  campaignId: string,
  currentUserId: string,
): AsyncGenerator<Entity> {
  for await (const payload of context.pubSub.subscribe(
    "entityWindowForceOpened",
    campaignId,
  )) {
    if (payload.targetUserIds.includes(currentUserId)) {
      yield payload.entity;
    }
  }
}

export const Subscription = {
  entityWindowForceOpened: {
    subscribe: async (
      _parent: unknown,
      args: { campaignId: string },
      context: GraphQLContext,
    ) => {
      try {
        // Any campaign member may subscribe — the Storyteller decides who
        // actually receives a given event via `target`, enforced by the
        // per-subscriber filter in `entityWindowForceOpenedSource` above,
        // not by this guard.
        await requireCampaignMember(context, args.campaignId);
      } catch (error) {
        toGraphQLError(error);
      }

      // requireCampaignMember succeeding guarantees context.currentUser is
      // set (it calls requireCurrentUser internally).
      const currentUserId = context.currentUser!.Id.toString();

      return entityWindowForceOpenedSource(
        context,
        args.campaignId,
        currentUserId,
      );
    },
    resolve: (entity: Entity) => entity,
  },
};
