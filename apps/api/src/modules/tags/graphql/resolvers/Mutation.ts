import type { GraphQLContext } from "../../../../graphql/context";
import { toGraphQLError } from "../../../../graphql/errors";

export const Mutation = {
  addTagToEntity: async (
    _parent: unknown,
    args: { entityId: string; name: string },
    context: GraphQLContext,
  ) => {
    try {
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
      return await context.tagService.removeTagFromEntity(
        args.entityId,
        args.tagId,
      );
    } catch (error) {
      toGraphQLError(error);
    }
  },
};
