import { AuthenticationError } from "@storyforge/domain";
import { GraphQLContext } from "../../../graphql/context";

export function requireCurrentUser(context: GraphQLContext) {
  if (!context.currentUser) {
    throw new AuthenticationError("Not authenticated");
  }
  return context.currentUser;
}
