import {
  canViewVisibility,
  EntityFilter,
  filterByVisibility,
  ForbiddenError,
} from "@storyforge/domain";
import type { GraphQLContext } from "../../../../graphql/context";
import { toGraphQLError } from "../../../../graphql/errors";
import { requireCurrentUser } from "../../../auth/graphql/guards";
import { requireCampaignRole } from "../../../campaignMembers/graphql/guards";

export const Query = {
  entity: async (
    _parent: unknown,
    args: { id: string },
    context: GraphQLContext,
  ) => {
    try {
      requireCurrentUser(context);
      const entity = await context.entityService.getEntity(args.id);
      const membership = await requireCampaignRole(
        context,
        entity.CampaignId,
        "VIEW_ENTITY",
      );

      if (!canViewVisibility(entity.Visibility, membership.Role)) {
        throw new ForbiddenError("You cannot view this entity.");
      }

      return entity;
    } catch (error) {
      toGraphQLError(error);
    }
  },

  entities: async (
    _parent: unknown,
    args: { campaignId: string; filter?: EntityFilter | null },
    context: GraphQLContext,
  ) => {
    try {
      const membership = await requireCampaignRole(
        context,
        args.campaignId,
        "VIEW_ENTITY",
      );
      const entities = await context.entityService.listEntities(
        args.campaignId,
        args.filter,
      );

      return filterByVisibility(entities, membership.Role);
    } catch (error) {
      toGraphQLError(error);
    }
  },
};
