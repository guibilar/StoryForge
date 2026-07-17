import type { GraphQLContext } from "../../../../graphql/context";
import { toGraphQLError } from "../../../../graphql/errors";
import { requireCurrentUser } from "../../../auth/graphql/guards";
import { requireCampaignMember } from "../../../campaignMembers/graphql/guards";

export const Query = {
  myWorkspaceState: async (
    _parent: unknown,
    args: { campaignId: string },
    context: GraphQLContext,
  ) => {
    try {
      const currentUser = requireCurrentUser(context);
      await requireCampaignMember(context, args.campaignId);

      return await context.workspaceService.getWorkspaceState(
        currentUser.Id.toString(),
        args.campaignId,
      );
    } catch (error) {
      toGraphQLError(error);
    }
  },
};
