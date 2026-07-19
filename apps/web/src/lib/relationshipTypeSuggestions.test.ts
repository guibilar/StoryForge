import { describe, expect, it } from "vitest";

import { suggestRelationshipTypes } from "./relationshipTypeSuggestions";

describe("suggestRelationshipTypes", () => {
  it("suggests character-to-character types", () => {
    expect(suggestRelationshipTypes("CHARACTER", "CHARACTER")).toEqual([
      "Ally",
      "Enemy",
      "Parent",
      "Child",
    ]);
  });

  it("suggests MemberOf for a character-organization pair regardless of order", () => {
    expect(suggestRelationshipTypes("CHARACTER", "ORGANIZATION")).toEqual([
      "MemberOf",
    ]);
    expect(suggestRelationshipTypes("ORGANIZATION", "CHARACTER")).toEqual([
      "MemberOf",
    ]);
  });

  it("suggests Owns for a character-item pair", () => {
    expect(suggestRelationshipTypes("CHARACTER", "ITEM")).toEqual(["Owns"]);
  });

  it("returns no suggestions for an unmapped category pair", () => {
    expect(suggestRelationshipTypes("LOCATION", "ITEM")).toEqual([]);
  });

  it("returns no suggestions when either category is unknown", () => {
    expect(suggestRelationshipTypes(undefined, "CHARACTER")).toEqual([]);
    expect(suggestRelationshipTypes("CHARACTER", undefined)).toEqual([]);
  });
});
