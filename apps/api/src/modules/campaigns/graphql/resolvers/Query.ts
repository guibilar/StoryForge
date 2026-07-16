import type { GraphQLContext } from "../../../../graphql/context";
import { toGraphQLError } from "../../../../graphql/errors";
import { requireCurrentUser } from "../../../auth/graphql/guards";
import { requireCampaignMember } from "../../../campaignMembers/graphql/guards";

export const Query = {
  campaign: async (
    _parent: unknown,
    args: { id: string },
    context: GraphQLContext,
  ) => {
    try {
      await requireCampaignMember(context, args.id);
      return await context.campaignService.getCampaignById(args.id);
    } catch (error) {
      toGraphQLError(error);
    }
  },

  campaigns: async (
    _parent: unknown,
    _args: unknown,
    context: GraphQLContext,
  ) => {
    try {
      const currentUser = requireCurrentUser(context);
      return await context.campaignService.listCampaigns(
        currentUser.Id.toString(),
      );
    } catch (error) {
      toGraphQLError(error);
    }
  },
};
