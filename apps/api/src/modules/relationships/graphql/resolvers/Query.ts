import type { GraphQLContext } from "../../../../graphql/context";
import { toGraphQLError } from "../../../../graphql/errors";
import { requireCurrentUser } from "../../../auth/graphql/guards";
import { requireCampaignMember } from "../../../campaignMembers/graphql/guards";

export const Query = {
  relationship: async (
    _parent: unknown,
    args: { id: string },
    context: GraphQLContext,
  ) => {
    try {
      requireCurrentUser(context);
      const relationship = await context.relationshipService.getRelationship(
        args.id,
      );
      await requireCampaignMember(context, relationship.CampaignId);
      return relationship;
    } catch (error) {
      toGraphQLError(error);
    }
  },

  relationships: async (
    _parent: unknown,
    args: { campaignId: string; entityId?: string | null },
    context: GraphQLContext,
  ) => {
    try {
      await requireCampaignMember(context, args.campaignId);
      if (args.entityId) {
        return await context.relationshipService.listRelationshipsByEntity(
          args.entityId,
        );
      }

      return await context.relationshipService.listRelationshipsByCampaign(
        args.campaignId,
      );
    } catch (error) {
      toGraphQLError(error);
    }
  },
};
