import type { GraphQLContext } from "../../../../graphql/context";
import { toGraphQLError } from "../../../../graphql/errors";

export const Query = {
  campaignTags: async (
    _parent: unknown,
    args: { campaignId: string },
    context: GraphQLContext,
  ) => {
    try {
      return await context.tagService.listCampaignTags(args.campaignId);
    } catch (error) {
      toGraphQLError(error);
    }
  },
};
