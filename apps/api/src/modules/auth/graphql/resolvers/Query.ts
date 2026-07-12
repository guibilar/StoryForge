import { GraphQLContext } from "../../../../graphql/context";

export const Query = {
  me: async (_parent: unknown, _args: unknown, context: GraphQLContext) => {
    return context.currentUser;
  },
};
