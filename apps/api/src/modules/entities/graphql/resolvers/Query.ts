import {
  EntityFilter,
  EntityVisibility,
  ForbiddenError,
} from "@storyforge/domain";
import type { GraphQLContext } from "../../../../graphql/context";
import { toGraphQLError } from "../../../../graphql/errors";
import { requireCurrentUser } from "../../../auth/graphql/guards";
import { requireCampaignMember } from "../../../campaignMembers/graphql/guards";

export const Query = {
  entity: async (
    _parent: unknown,
    args: { id: string },
    context: GraphQLContext,
  ) => {
    try {
      requireCurrentUser(context);
      const entity = await context.entityService.getEntity(args.id);
      const membership = await requireCampaignMember(
        context,
        entity.CampaignId,
      );

      if (
        membership.Role === "PLAYER" &&
        entity.Visibility !== EntityVisibility.PUBLIC
      ) {
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
      const membership = await requireCampaignMember(context, args.campaignId);
      const entities = await context.entityService.listEntities(
        args.campaignId,
        args.filter,
      );

      if (membership.Role === "PLAYER") {
        return entities.filter(
          (entity) => entity.Visibility === EntityVisibility.PUBLIC,
        );
      }

      return entities;
    } catch (error) {
      toGraphQLError(error);
    }
  },
};
