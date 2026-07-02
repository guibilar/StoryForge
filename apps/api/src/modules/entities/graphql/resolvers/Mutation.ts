import type { GraphQLContext } from "../../../../graphql/context";
import { toGraphQLError } from "../../../../graphql/errors";
import type {
  CreateEntityDto,
  UpdateEntityDto,
} from "../../application/EntityService";

export const Mutation = {
  createEntity: async (
    _parent: unknown,
    args: { input: CreateEntityDto },
    context: GraphQLContext,
  ) => {
    try {
      return await context.entityService.createEntity(args.input);
    } catch (error) {
      toGraphQLError(error);
    }
  },

  updateEntity: async (
    _parent: unknown,
    args: { input: UpdateEntityDto },
    context: GraphQLContext,
  ) => {
    try {
      return await context.entityService.updateEntity(args.input);
    } catch (error) {
      toGraphQLError(error);
    }
  },

  deleteEntity: async (
    _parent: unknown,
    args: { id: string },
    context: GraphQLContext,
  ) => {
    try {
      await context.entityService.deleteEntity(args.id);
      return true;
    } catch (error) {
      toGraphQLError(error);
    }
  },
};
