import type { GraphQLContext } from "../../../../graphql/context";
import { toGraphQLError } from "../../../../graphql/errors";

export const Query = {
  campaign: async (
    _parent: unknown,
    args: { id: string },
    context: GraphQLContext,
  ) => {
    try {
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
      return await context.campaignService.listCampaigns();
    } catch (error) {
      toGraphQLError(error);
    }
  },
};
