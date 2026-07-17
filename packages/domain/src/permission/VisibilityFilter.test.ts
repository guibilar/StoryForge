import { describe, expect, it } from "vitest";
import { canViewVisibility, filterByVisibility } from "./VisibilityFilter";
import { EntityVisibility } from "../entity";
import type { CampaignRole } from "../campaignMember";

describe("canViewVisibility", () => {
  it.each(["OWNER", "STORYTELLER", "CO_STORYTELLER"] satisfies CampaignRole[])(
    "%s can view every visibility level",
    (role) => {
      expect(canViewVisibility(EntityVisibility.PUBLIC, role)).toBe(true);
      expect(canViewVisibility(EntityVisibility.STORYTELLER, role)).toBe(true);
      expect(canViewVisibility(EntityVisibility.PRIVATE, role)).toBe(true);
    },
  );

  it.each(["PLAYER", "OBSERVER"] satisfies CampaignRole[])(
    "%s can only view PUBLIC visibility",
    (role) => {
      expect(canViewVisibility(EntityVisibility.PUBLIC, role)).toBe(true);
      expect(canViewVisibility(EntityVisibility.STORYTELLER, role)).toBe(false);
      expect(canViewVisibility(EntityVisibility.PRIVATE, role)).toBe(false);
    },
  );
});

describe("filterByVisibility", () => {
  const items = [
    { Visibility: EntityVisibility.PUBLIC },
    { Visibility: EntityVisibility.STORYTELLER },
    { Visibility: EntityVisibility.PRIVATE },
  ];

  it.each(["OWNER", "STORYTELLER", "CO_STORYTELLER"] satisfies CampaignRole[])(
    "returns the same array instance for %s",
    (role) => {
      expect(filterByVisibility(items, role)).toBe(items);
    },
  );

  it.each(["PLAYER", "OBSERVER"] satisfies CampaignRole[])(
    "returns only PUBLIC items for %s",
    (role) => {
      expect(filterByVisibility(items, role)).toEqual([
        { Visibility: EntityVisibility.PUBLIC },
      ]);
    },
  );
});
