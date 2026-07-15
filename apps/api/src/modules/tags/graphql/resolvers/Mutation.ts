import type { GraphQLContext } from "../../../../graphql/context";
import { toGraphQLError } from "../../../../graphql/errors";
import { requireCurrentUser } from "../../../auth/graphql/guards";
import { requireCampaignMember } from "../../../campaignMembers/graphql/guards";

export const Mutation = {
  addTagToEntity: async (
    _parent: unknown,
    args: { entityId: string; name: string },
    context: GraphQLContext,
  ) => {
    try {
      requireCurrentUser(context);
      const entity = await context.entityService.getEntity(args.entityId);
      await requireCampaignMember(context, entity.CampaignId);
      return await context.tagService.addTagToEntity(args.entityId, args.name);
    } catch (error) {
      toGraphQLError(error);
    }
  },

  removeTagFromEntity: async (
    _parent: unknown,
    args: { entityId: string; tagId: string },
    context: GraphQLContext,
  ) => {
    try {
      requireCurrentUser(context);
      const entity = await context.entityService.getEntity(args.entityId);
      await requireCampaignMember(context, entity.CampaignId);
      return await context.tagService.removeTagFromEntity(
        args.entityId,
        args.tagId,
      );
    } catch (error) {
      toGraphQLError(error);
    }
  },
};
