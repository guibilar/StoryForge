import { describe, expect, it } from "vitest";
import { visibleWindowCatalog } from "./windowCatalog";
import type { CampaignRole } from "../gql/graphql";

describe("visibleWindowCatalog", () => {
  it.each(["OWNER", "STORYTELLER", "CO_STORYTELLER"] satisfies CampaignRole[])(
    "includes the Members window for %s",
    (role) => {
      const ids = visibleWindowCatalog(role).map((entry) => entry.id);

      expect(ids).toContain("members");
    },
  );

  it.each(["PLAYER", "OBSERVER"] satisfies CampaignRole[])(
    "excludes the Members window for %s",
    (role) => {
      const ids = visibleWindowCatalog(role).map((entry) => entry.id);

      expect(ids).not.toContain("members");
    },
  );

  it("excludes the Members window when the role is unknown", () => {
    const ids = visibleWindowCatalog(undefined).map((entry) => entry.id);

    expect(ids).not.toContain("members");
  });

  it.each([
    "OWNER",
    "STORYTELLER",
    "CO_STORYTELLER",
    "PLAYER",
    "OBSERVER",
  ] satisfies CampaignRole[])(
    "includes the Notes window for %s now that the API filters note visibility",
    (role) => {
      const ids = visibleWindowCatalog(role).map((entry) => entry.id);

      expect(ids).toContain("notes");
    },
  );

  it.each([
    "OWNER",
    "STORYTELLER",
    "CO_STORYTELLER",
    "PLAYER",
    "OBSERVER",
    undefined,
  ] satisfies (CampaignRole | undefined)[])(
    "always includes the Relationship Graph window for %s (view-only)",
    (role) => {
      const ids = visibleWindowCatalog(role).map((entry) => entry.id);

      expect(ids).toContain("relationships");
    },
  );

  it.each([
    "OWNER",
    "STORYTELLER",
    "CO_STORYTELLER",
    "PLAYER",
    "OBSERVER",
    undefined,
  ] satisfies (CampaignRole | undefined)[])(
    "always includes the Maps window for %s (view-only)",
    (role) => {
      const ids = visibleWindowCatalog(role).map((entry) => entry.id);

      expect(ids).toContain("maps");
    },
  );
});
