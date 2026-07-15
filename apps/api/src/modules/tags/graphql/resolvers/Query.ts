import type { GraphQLContext } from "../../../../graphql/context";
import { toGraphQLError } from "../../../../graphql/errors";
import { requireCurrentUser } from "../../../auth/graphql/guards";

export const Query = {
  campaignTags: async (
    _parent: unknown,
    args: { campaignId: string },
    context: GraphQLContext,
  ) => {
    try {
      requireCurrentUser(context);
      return await context.tagService.listCampaignTags(args.campaignId);
    } catch (error) {
      toGraphQLError(error);
    }
  },
};
