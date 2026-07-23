import type { GraphQLContext } from "../../../../graphql/context";
import { toGraphQLError } from "../../../../graphql/errors";
import { requireCurrentUser } from "../../../auth/graphql/guards";
import { requireCampaignMember } from "../../../campaignMembers/graphql/guards";
import {
  filterViewableRelationships,
  requireRelationshipViewer,
} from "../guards";

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
      await requireRelationshipViewer(context, relationship);
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
      const relationships = args.entityId
        ? await context.relationshipService.listRelationshipsByEntity(
            args.campaignId,
            args.entityId,
          )
        : await context.relationshipService.listRelationshipsByCampaign(
            args.campaignId,
          );

      return await filterViewableRelationships(
        context,
        args.campaignId,
        relationships,
      );
    } catch (error) {
      toGraphQLError(error);
    }
  },
};
