import { describe, expect, it } from "vitest";
import jwt from "jsonwebtoken";

import { getCurrentUserId } from "./context";
import { JWT_SECRET } from "../config/env";

function makeRequest(headers: Record<string, string>): Request {
  return new Request("http://localhost/graphql", { headers });
}

describe("getCurrentUserId", () => {
  const userId = "11111111-1111-1111-1111-111111111111";
  const token = jwt.sign({ sub: userId }, JWT_SECRET);

  it("returns null when no header or cookie is present", () => {
    expect(getCurrentUserId(makeRequest({}))).toBeNull();
  });

  it("reads the user id from an Authorization Bearer header", () => {
    expect(
      getCurrentUserId(makeRequest({ authorization: `Bearer ${token}` })),
    ).toBe(userId);
  });

  it("falls back to the token cookie when there is no Bearer header", () => {
    expect(getCurrentUserId(makeRequest({ cookie: `token=${token}` }))).toBe(
      userId,
    );
  });

  it("prefers the Authorization header over the cookie when both are present", () => {
    const otherUserId = "22222222-2222-2222-2222-222222222222";
    const otherToken = jwt.sign({ sub: otherUserId }, JWT_SECRET);

    expect(
      getCurrentUserId(
        makeRequest({
          authorization: `Bearer ${token}`,
          cookie: `token=${otherToken}`,
        }),
      ),
    ).toBe(userId);
  });

  it("returns null for an invalid token", () => {
    expect(
      getCurrentUserId(makeRequest({ authorization: "Bearer not-a-token" })),
    ).toBeNull();
  });

  it("returns null for a well-formed but wrong-secret token", () => {
    const forged = jwt.sign({ sub: userId }, "wrong-secret");

    expect(
      getCurrentUserId(makeRequest({ authorization: `Bearer ${forged}` })),
    ).toBeNull();
  });
});
