import type { GraphQLContext } from "../../../../graphql/context";
import { toGraphQLError } from "../../../../graphql/errors";
import { requireCurrentUser } from "../../../auth/graphql/guards";
import { requireCampaignMember } from "../../../campaignMembers/graphql/guards";

export const Query = {
  session: async (
    _parent: unknown,
    args: { id: string },
    context: GraphQLContext,
  ) => {
    try {
      requireCurrentUser(context);
      const session = await context.sessionService.getSession(args.id);
      await requireCampaignMember(context, session.CampaignId);
      return session;
    } catch (error) {
      toGraphQLError(error);
    }
  },

  sessions: async (
    _parent: unknown,
    args: { campaignId: string },
    context: GraphQLContext,
  ) => {
    try {
      await requireCampaignMember(context, args.campaignId);
      return await context.sessionService.listSessions(args.campaignId);
    } catch (error) {
      toGraphQLError(error);
    }
  },
};
