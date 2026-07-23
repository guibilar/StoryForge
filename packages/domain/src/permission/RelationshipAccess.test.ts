import { describe, expect, it } from "vitest";

import {
  canSeeRelationshipEndpoint,
  canViewRelationshipVisibility,
} from "./RelationshipAccess";
import {
  Relationship,
  RelationshipEndpoint,
  RelationshipVisibility,
} from "../relationship";
import { UserId } from "../user";
import type { CampaignRole } from "../campaignMember";

const player = UserId.create();
const otherPlayer = UserId.create();

function makeRelationship(
  visibility: RelationshipVisibility,
  recipientIds: UserId[] = [],
  concealedEndpoint: RelationshipEndpoint | null = null,
): Relationship {
  return Relationship.create({
    campaignId: "campaign-1",
    sourceEntityId: "entity-1",
    targetEntityId: "entity-2",
    type: "Sired by",
    visibility,
    recipientIds,
    concealedEndpoint,
  });
}

describe("canViewRelationshipVisibility", () => {
  it.each(["OWNER", "STORYTELLER", "CO_STORYTELLER"] satisfies CampaignRole[])(
    "%s sees every level",
    (role) => {
      expect(
        canViewRelationshipVisibility(
          makeRelationship(RelationshipVisibility.STORYTELLER),
          player,
          role,
        ),
      ).toBe(true);
      expect(
        canViewRelationshipVisibility(
          makeRelationship(RelationshipVisibility.TARGETED, [otherPlayer]),
          player,
          role,
        ),
      ).toBe(true);
    },
  );

  it.each(["PLAYER", "OBSERVER"] satisfies CampaignRole[])(
    "%s sees a PUBLIC relationship",
    (role) => {
      expect(
        canViewRelationshipVisibility(
          makeRelationship(RelationshipVisibility.PUBLIC),
          player,
          role,
        ),
      ).toBe(true);
    },
  );

  it.each(["PLAYER", "OBSERVER"] satisfies CampaignRole[])(
    "%s never sees a STORYTELLER relationship",
    (role) => {
      expect(
        canViewRelationshipVisibility(
          makeRelationship(RelationshipVisibility.STORYTELLER),
          player,
          role,
        ),
      ).toBe(false);
    },
  );

  it("shows a TARGETED relationship only to the players named on it", () => {
    const relationship = makeRelationship(RelationshipVisibility.TARGETED, [
      player,
    ]);

    expect(canViewRelationshipVisibility(relationship, player, "PLAYER")).toBe(
      true,
    );
    expect(
      canViewRelationshipVisibility(relationship, otherPlayer, "PLAYER"),
    ).toBe(false);
  });
});

describe("canSeeRelationshipEndpoint", () => {
  it.each(["OWNER", "STORYTELLER", "CO_STORYTELLER"] satisfies CampaignRole[])(
    "%s sees both endpoints regardless of concealment",
    (role) => {
      const relationship = makeRelationship(
        RelationshipVisibility.PUBLIC,
        [],
        RelationshipEndpoint.SOURCE,
      );

      expect(
        canSeeRelationshipEndpoint(
          relationship,
          RelationshipEndpoint.SOURCE,
          role,
        ),
      ).toBe(true);
      expect(
        canSeeRelationshipEndpoint(
          relationship,
          RelationshipEndpoint.TARGET,
          role,
        ),
      ).toBe(true);
    },
  );

  it.each(["PLAYER", "OBSERVER"] satisfies CampaignRole[])(
    "%s cannot see the concealed side, but can see the other",
    (role) => {
      const relationship = makeRelationship(
        RelationshipVisibility.PUBLIC,
        [],
        RelationshipEndpoint.TARGET,
      );

      expect(
        canSeeRelationshipEndpoint(
          relationship,
          RelationshipEndpoint.TARGET,
          role,
        ),
      ).toBe(false);
      expect(
        canSeeRelationshipEndpoint(
          relationship,
          RelationshipEndpoint.SOURCE,
          role,
        ),
      ).toBe(true);
    },
  );

  it("sees both sides when nothing is concealed", () => {
    const relationship = makeRelationship(RelationshipVisibility.PUBLIC);

    expect(
      canSeeRelationshipEndpoint(
        relationship,
        RelationshipEndpoint.SOURCE,
        "PLAYER",
      ),
    ).toBe(true);
    expect(
      canSeeRelationshipEndpoint(
        relationship,
        RelationshipEndpoint.TARGET,
        "PLAYER",
      ),
    ).toBe(true);
  });
});

describe("Relationship visibility invariants", () => {
  it("drops recipients when the level is not TARGETED", () => {
    const relationship = makeRelationship(RelationshipVisibility.PUBLIC, [
      player,
    ]);

    expect(relationship.RecipientIds).toEqual([]);
  });

  it("rejects a TARGETED relationship with nobody to show it to", () => {
    expect(() => makeRelationship(RelationshipVisibility.TARGETED, [])).toThrow(
      "A targeted relationship needs at least one recipient.",
    );
  });

  it("dedupes recipients", () => {
    const relationship = makeRelationship(RelationshipVisibility.TARGETED, [
      player,
      player,
    ]);

    expect(relationship.RecipientIds).toHaveLength(1);
  });

  it("clears recipients when moving off TARGETED", () => {
    const relationship = makeRelationship(RelationshipVisibility.TARGETED, [
      player,
    ]);

    relationship.changeVisibility(RelationshipVisibility.PUBLIC);

    expect(relationship.Visibility).toBe(RelationshipVisibility.PUBLIC);
    expect(relationship.RecipientIds).toEqual([]);
  });

  it("defaults to PUBLIC so existing relationships keep behaving as before", () => {
    const relationship = Relationship.create({
      campaignId: "campaign-1",
      sourceEntityId: "entity-1",
      targetEntityId: "entity-2",
      type: "Ally",
    });

    expect(relationship.Visibility).toBe(RelationshipVisibility.PUBLIC);
  });
});
