import { describe, expect, it } from "vitest";
import { User } from "@storyforge/domain";
import { Query } from "./Query";
import type { GraphQLContext } from "../../../../graphql/context";

function makeContext(currentUser: User | null): GraphQLContext {
  return { currentUser } as GraphQLContext;
}

describe("Query.me", () => {
  it("returns null when logged out", async () => {
    const context = makeContext(null);

    await expect(Query.me(undefined, undefined, context)).resolves.toBeNull();
  });

  it("returns the current user when logged in", async () => {
    const user = User.create({ email: "user@example.com", password: "hashed" });
    const context = makeContext(user);

    await expect(Query.me(undefined, undefined, context)).resolves.toBe(user);
  });
});
