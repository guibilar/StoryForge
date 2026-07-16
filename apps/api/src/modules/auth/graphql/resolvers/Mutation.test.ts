import { describe, expect, it, vi } from "vitest";
import { User } from "@storyforge/domain";

import { Mutation } from "./Mutation";
import type { GraphQLContext } from "../../../../graphql/context";

function makeContext(
  overrides: Partial<GraphQLContext["authenticationService"]> = {},
): GraphQLContext & {
  setAuthCookie: ReturnType<typeof vi.fn>;
  clearAuthCookie: ReturnType<typeof vi.fn>;
} {
  return {
    authenticationService: overrides as GraphQLContext["authenticationService"],
    setAuthCookie: vi.fn(),
    clearAuthCookie: vi.fn(),
  } as unknown as GraphQLContext & {
    setAuthCookie: ReturnType<typeof vi.fn>;
    clearAuthCookie: ReturnType<typeof vi.fn>;
  };
}

describe("Mutation.login", () => {
  it("sets the auth cookie with the issued token", async () => {
    const user = User.create({ email: "user@example.com", password: "hashed" });
    const context = makeContext({
      login: vi.fn().mockResolvedValue({ token: "jwt-token", user }),
    });

    const result = await Mutation.login(
      undefined,
      { input: { email: "user@example.com", password: "secret" } },
      context,
    );

    expect(context.setAuthCookie).toHaveBeenCalledWith("jwt-token");
    expect(result).toEqual({ token: "jwt-token", user });
  });
});

describe("Mutation.registerUser", () => {
  it("sets the auth cookie with the issued token", async () => {
    const user = User.create({ email: "new@example.com", password: "hashed" });
    const context = makeContext({
      register: vi.fn().mockResolvedValue({ token: "jwt-token", user }),
    });

    const result = await Mutation.registerUser(
      undefined,
      { input: { email: "new@example.com", password: "secret" } },
      context,
    );

    expect(context.setAuthCookie).toHaveBeenCalledWith("jwt-token");
    expect(result).toEqual({ token: "jwt-token", user });
  });
});

describe("Mutation.logout", () => {
  it("clears the auth cookie and returns true", () => {
    const context = makeContext();

    const result = Mutation.logout(undefined, undefined, context);

    expect(context.clearAuthCookie).toHaveBeenCalled();
    expect(result).toBe(true);
  });
});
