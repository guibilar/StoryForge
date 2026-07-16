import type { GraphQLContext } from "../../../../graphql/context";
import { toGraphQLError } from "../../../../graphql/errors";

export const Mutation = {
  login: async (
    _parent: unknown,
    args: { input: { email: string; password: string } },
    context: GraphQLContext,
  ) => {
    try {
      const result = await context.authenticationService.login(args.input);
      context.setAuthCookie(result.token);
      return result;
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
      const result = await context.authenticationService.register(args.input);
      context.setAuthCookie(result.token);
      return result;
    } catch (error) {
      toGraphQLError(error);
    }
  },

  logout: (_parent: unknown, _args: unknown, context: GraphQLContext) => {
    context.clearAuthCookie();
    return true;
  },
};
