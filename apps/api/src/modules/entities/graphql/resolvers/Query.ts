import { EntityFilter } from "@storyforge/domain";
import type { GraphQLContext } from "../../../../graphql/context";
import { toGraphQLError } from "../../../../graphql/errors";
import { requireCurrentUser } from "../../../auth/graphql/guards";

export const Query = {
  entity: async (
    _parent: unknown,
    args: { id: string },
    context: GraphQLContext,
  ) => {
    try {
      requireCurrentUser(context);
      return await context.entityService.getEntity(args.id);
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
      requireCurrentUser(context);
      return await context.entityService.listEntities(
        args.campaignId,
        args.filter,
      );
    } catch (error) {
      toGraphQLError(error);
    }
  },
};
