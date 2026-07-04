import type { GraphQLContext } from "../../../../graphql/context";
import { toGraphQLError } from "../../../../graphql/errors";

export const Mutation = {
  login: async (
    _parent: unknown,
    args: { input: { email: string; password: string } },
    context: GraphQLContext,
  ) => {
    try {
      return await context.authenticationService.login(args.input);
    } catch (error) {
      toGraphQLError(error);
    }
  },

  registerUser: async (
    _parent: unknown,
    args: { input: { email: string; password: string } },
    context: GraphQLContext,
  ) => {
    try {
      return await context.authenticationService.register(args.input);
    } catch (error) {
      toGraphQLError(error);
    }
  },
};
