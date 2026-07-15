import type { GraphQLContext } from "../../../../graphql/context";
import { toGraphQLError } from "../../../../graphql/errors";
import { requireCampaignMember } from "../../../campaignMembers/graphql/guards";

export const Query = {
  campaignTags: async (
    _parent: unknown,
    args: { campaignId: string },
    context: GraphQLContext,
  ) => {
    try {
      await requireCampaignMember(context, args.campaignId);
      return await context.tagService.listCampaignTags(args.campaignId);
    } catch (error) {
      toGraphQLError(error);
    }
  },
};
