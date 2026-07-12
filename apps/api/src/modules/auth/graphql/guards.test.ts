import { describe, expect, it } from "vitest";
import { AuthenticationError, User } from "@storyforge/domain";
import { requireCurrentUser } from "./guards";
import type { GraphQLContext } from "../../../graphql/context";

function makeContext(currentUser: User | null): GraphQLContext {
  return { currentUser } as GraphQLContext;
}

describe("requireCurrentUser", () => {
  it("throws AuthenticationError when there is no current user", () => {
    const context = makeContext(null);

    expect(() => requireCurrentUser(context)).toThrow(AuthenticationError);
  });

  it("returns the current user when authenticated", () => {
    const user = User.create({ email: "user@example.com", password: "hashed" });
    const context = makeContext(user);

    expect(requireCurrentUser(context)).toBe(user);
  });
});
