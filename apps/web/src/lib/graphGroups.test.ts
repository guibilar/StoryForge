import { describe, expect, it } from "vitest";

import {
  affiliationTypeOptions,
  defaultAffiliationTypes,
  deriveGroups,
  type GroupableEntity,
} from "./graphGroups";

function entity(
  id: string,
  name: string,
  category: string,
  type = "npc",
  tags: Array<{ id: string; name: string }> = [],
): GroupableEntity {
  return { id, name, category, type, tags };
}

const CAMARILLA = entity("org-1", "The Camarilla", "ORGANIZATION", "sect");
const ANARCHS = entity("org-2", "Anarch Movement", "ORGANIZATION", "sect");
const NADIA = entity("ent-1", "Nadia", "CHARACTER");
const ADRIAN = entity("ent-2", "Adrian", "CHARACTER");
const MARCUS = entity("ent-3", "Marcus", "CHARACTER");

const ENTITIES = [CAMARILLA, ANARCHS, NADIA, ADRIAN, MARCUS];

const LINKS = [
  { source: "ent-1", target: "org-1", type: "MemberOf" },
  { source: "ent-2", target: "org-1", type: "MemberOf" },
  { source: "ent-3", target: "org-2", type: "MemberOf" },
  // Org to org: a relationship between two clusters, not membership.
  { source: "org-1", target: "org-2", type: "Rivals" },
];

describe("deriveGroups", () => {
  it("returns nothing when grouping is off", () => {
    expect(deriveGroups("none", ENTITIES, LINKS).groups).toHaveLength(0);
  });

  describe("faction mode", () => {
    it("clusters entities by the organization they link to", () => {
      const { groups } = deriveGroups("faction", ENTITIES, LINKS);

      expect(groups.map((group) => group.label)).toEqual([
        "Anarch Movement",
        "The Camarilla",
      ]);
      expect(
        groups.find((group) => group.label === "The Camarilla")?.memberIds,
      ).toEqual(["ent-1", "ent-2"]);
    });

    // No hard-coded vocabulary: with no affiliation types supplied, any link
    // from a character to an organization counts, whatever it's called.
    it("accepts a campaign's own vocabulary for membership", () => {
      const { groups } = deriveGroups("faction", ENTITIES, [
        { source: "ent-1", target: "org-1", type: "Sworn To" },
      ]);

      expect(groups[0].memberIds).toEqual(["ent-1"]);
    });

    // The whole point of the category filter: a location standing inside the
    // chapterhouse, or an item the org owns, is linked to it without being
    // part of it.
    it("only a CHARACTER can belong to an organization", () => {
      const chapterhouse = entity("loc-1", "Chantry", "LOCATION", "building");
      const relic = entity("item-1", "The Ledger", "ITEM", "relic");

      const { groups } = deriveGroups(
        "faction",
        [CAMARILLA, NADIA, chapterhouse, relic],
        [
          { source: "ent-1", target: "org-1", type: "MemberOf" },
          { source: "loc-1", target: "org-1", type: "LocatedAt" },
          { source: "item-1", target: "org-1", type: "Owns" },
        ],
      );

      expect(groups[0].memberIds).toEqual(["ent-1"]);
    });

    // Same category pair as a real membership, so only the type separates
    // "belongs to the Camarilla" from "works out of its building".
    it("excludes a character link whose type isn't an affiliation type", () => {
      const links = [
        { source: "ent-1", target: "org-1", type: "MemberOf" },
        { source: "ent-2", target: "org-1", type: "LocatedAt" },
      ];

      const { groups } = deriveGroups(
        "faction",
        ENTITIES,
        links,
        new Set(["MemberOf"]),
      );

      expect(groups[0].memberIds).toEqual(["ent-1"]);
    });

    it("marks the organization as absorbed so it stops being a node", () => {
      const { absorbedEntityIds } = deriveGroups("faction", ENTITIES, LINKS);

      expect([...absorbedEntityIds].sort()).toEqual(["org-1", "org-2"]);
    });

    it("does not treat an org-to-org link as membership", () => {
      const { groups } = deriveGroups("faction", ENTITIES, LINKS);

      for (const group of groups) {
        expect(group.memberIds).not.toContain("org-1");
        expect(group.memberIds).not.toContain("org-2");
      }
    });

    it("leaves a memberless organization as an ordinary node", () => {
      const { groups, absorbedEntityIds } = deriveGroups(
        "faction",
        [CAMARILLA, ANARCHS, NADIA],
        [{ source: "ent-1", target: "org-1", type: "MemberOf" }],
      );

      expect(groups).toHaveLength(1);
      expect(absorbedEntityIds.has("org-2")).toBe(false);
    });

    it("puts an entity in only one cluster when it belongs to several", () => {
      const { groups, groupOf } = deriveGroups("faction", ENTITIES, [
        { source: "ent-1", target: "org-1", type: "MemberOf" },
        { source: "ent-1", target: "org-2", type: "MemberOf" },
      ]);

      const appearances = groups.filter((group) =>
        group.memberIds.includes("ent-1"),
      );
      expect(appearances).toHaveLength(1);
      expect(groupOf.get("ent-1")).toBe(appearances[0].id);
    });
  });

  it("groups by type, dropping buckets of one", () => {
    const { groups } = deriveGroups(
      "type",
      [
        entity("a", "A", "CHARACTER", "npc"),
        entity("b", "B", "CHARACTER", "npc"),
        entity("c", "C", "LOCATION", "city"),
      ],
      [],
    );

    // "city" has a single member — a hull round one node says nothing.
    expect(groups.map((group) => group.label)).toEqual(["npc"]);
  });

  it("groups by category", () => {
    const { groups } = deriveGroups("category", ENTITIES, []);

    expect(groups.map((group) => group.label).sort()).toEqual([
      "CHARACTER",
      "ORGANIZATION",
    ]);
  });

  it("groups by an entity's first tag by name", () => {
    const tagged = [
      entity("a", "A", "CHARACTER", "npc", [
        { id: "t2", name: "Zealots" },
        { id: "t1", name: "Allies" },
      ]),
      entity("b", "B", "CHARACTER", "npc", [{ id: "t1", name: "Allies" }]),
    ];

    const { groups } = deriveGroups("tag", tagged, []);

    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe("Allies");
    expect(groups[0].memberIds).toEqual(["a", "b"]);
  });

  describe("affiliationTypeOptions", () => {
    it("offers only the types joining a character to an organization", () => {
      const chapterhouse = entity("loc-1", "Chantry", "LOCATION", "building");

      const options = affiliationTypeOptions(
        [CAMARILLA, NADIA, chapterhouse],
        [
          { source: "ent-1", target: "org-1", type: "MemberOf" },
          { source: "ent-1", target: "org-1", type: "LocatedAt" },
          // Location to org, so it never becomes an affiliation candidate.
          { source: "loc-1", target: "org-1", type: "BuiltFor" },
          // Character to character.
          { source: "ent-1", target: "ent-2", type: "Ally" },
        ],
      );

      expect(options).toEqual(["LocatedAt", "MemberOf"]);
    });
  });

  describe("defaultAffiliationTypes", () => {
    it("ticks the app's own suggestion and leaves the rest off", () => {
      expect(
        defaultAffiliationTypes(["LocatedAt", "MemberOf"], ["MemberOf"]),
      ).toEqual(["MemberOf"]);
    });

    it("matches the suggestion case-insensitively", () => {
      expect(defaultAffiliationTypes(["memberof"], ["MemberOf"])).toEqual([
        "memberof",
      ]);
    });

    // Better to over-group and let them untick than to show an empty graph
    // and look broken to a campaign using its own vocabulary.
    it("falls back to everything when no suggestion is present", () => {
      expect(
        defaultAffiliationTypes(["Sworn To", "Ghoul Of"], ["MemberOf"]),
      ).toEqual(["Sworn To", "Ghoul Of"]);
    });
  });

  it("never absorbs an entity outside faction mode", () => {
    for (const mode of ["type", "category", "tag"] as const) {
      expect(deriveGroups(mode, ENTITIES, LINKS).absorbedEntityIds.size).toBe(
        0,
      );
    }
  });
});
