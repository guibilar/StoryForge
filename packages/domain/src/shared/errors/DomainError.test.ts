import { describe, expect, it } from "vitest";
import { DomainError } from "./DomainError";
import { ValidationError } from "./ValidationError";
import { NotFoundError } from "./NotFoundError";
import { AuthenticationError } from "./AuthenticationError";

describe.each([
  ["ValidationError", ValidationError],
  ["NotFoundError", NotFoundError],
  ["AuthenticationError", AuthenticationError],
])("%s", (name, ErrorClass) => {
  it(`is a DomainError named "${name}" carrying the message`, () => {
    const error = new ErrorClass("boom");

    expect(error).toBeInstanceOf(DomainError);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe(name);
    expect(error.message).toBe("boom");
  });
});
