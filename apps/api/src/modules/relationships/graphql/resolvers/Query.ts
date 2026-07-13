import type { GraphQLContext } from "../../../../graphql/context";
import { toGraphQLError } from "../../../../graphql/errors";

export const Query = {
  relationship: async (
    _parent: unknown,
    args: { id: string },
    context: GraphQLContext,
  ) => {
    try {
      return await context.relationshipService.getRelationship(args.id);
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
