import type { GraphQLContext } from "../../../../graphql/context";
import { toGraphQLError } from "../../../../graphql/errors";
import { requireCurrentUser } from "../../../auth/graphql/guards";
import {
  CreateRelationshipDto,
  UpdateRelationshipDto,
} from "../../application/RelationshipService";

export const Mutation = {
  createRelationship: async (
    _parent: unknown,
    args: { input: CreateRelationshipDto },
    context: GraphQLContext,
  ) => {
    try {
      requireCurrentUser(context);
      return await context.relationshipService.createRelationship(args.input);
    } catch (error) {
      toGraphQLError(error);
    }
  },

  updateRelationship: async (
    _parent: unknown,
    args: { input: UpdateRelationshipDto },
    context: GraphQLContext,
  ) => {
    try {
      requireCurrentUser(context);
      return await context.relationshipService.updateRelationship(args.input);
    } catch (error) {
      toGraphQLError(error);
    }
  },

  deleteRelationship: async (
    _parent: unknown,
    args: { id: string },
    context: GraphQLContext,
  ) => {
    try {
      requireCurrentUser(context);
      await context.relationshipService.deleteRelationship(args.id);
      return true;
    } catch (error) {
      toGraphQLError(error);
    }
  },
};
