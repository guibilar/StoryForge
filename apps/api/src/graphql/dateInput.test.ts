import { describe, expect, it } from "vitest";
import { ValidationError } from "@storyforge/domain";
import { parseOptionalDate, parseRequiredDate } from "./dateInput";

describe("parseRequiredDate", () => {
  it("parses a valid ISO string", () => {
    expect(parseRequiredDate("2024-01-01T00:00:00.000Z", "date")).toEqual(
      new Date("2024-01-01T00:00:00.000Z"),
    );
  });

  it("rejects an unparseable string", () => {
    expect(() => parseRequiredDate("not-a-date", "date")).toThrow(
      ValidationError,
    );
  });
});

describe("parseOptionalDate", () => {
  it("passes undefined through unchanged", () => {
    expect(parseOptionalDate(undefined, "date")).toBeUndefined();
  });

  it("rejects an explicit null instead of coercing to the 1970 epoch", () => {
    expect(() => parseOptionalDate(null, "date")).toThrow(ValidationError);
  });

  it("parses a valid ISO string", () => {
    expect(parseOptionalDate("2024-01-01T00:00:00.000Z", "date")).toEqual(
      new Date("2024-01-01T00:00:00.000Z"),
    );
  });

  it("rejects an unparseable string", () => {
    expect(() => parseOptionalDate("not-a-date", "date")).toThrow(
      ValidationError,
    );
  });
});
