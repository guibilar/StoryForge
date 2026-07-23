import { describe, expect, it, vi } from "vitest";
import {
  CampaignMember,
  Relationship as DomainRelationship,
  RelationshipEndpoint,
  User,
} from "@storyforge/domain";
import { Relationship } from "./Relationship";
import type { GraphQLContext } from "../../../../graphql/context";
import type { CampaignMemberService } from "../../../campaignMembers/application/CampaignMemberService";

const authenticatedUser = User.create({
  email: "user@example.com",
  password: "hashed",
});

function makeContext(role: "PLAYER" | "STORYTELLER"): GraphQLContext {
  const campaignMemberService = {
    getMembership: vi.fn().mockResolvedValue(
      CampaignMember.create({
        campaignId: "campaign-1",
        userId: authenticatedUser.Id,
        role,
      }),
    ),
  } as unknown as CampaignMemberService;

  return {
    campaignMemberService,
    currentUser: authenticatedUser,
  } as GraphQLContext;
}

function makeRelationship(
  concealedEndpoint: RelationshipEndpoint | null,
): DomainRelationship {
  return DomainRelationship.create({
    campaignId: "campaign-1",
    sourceEntityId: "entity-1",
    targetEntityId: "entity-2",
    type: "BLACKMAILS",
    concealedEndpoint,
  });
}

describe("Relationship.sourceEntityId / targetEntityId redaction", () => {
  it("returns both real ids to a Storyteller regardless of concealment", async () => {
    const relationship = makeRelationship(RelationshipEndpoint.TARGET);
    const context = makeContext("STORYTELLER");

    await expect(
      Relationship.sourceEntityId(relationship, {}, context),
    ).resolves.toBe("entity-1");
    await expect(
      Relationship.targetEntityId(relationship, {}, context),
    ).resolves.toBe("entity-2");
  });

  it("nulls out the concealed side for a Player, keeps the other real", async () => {
    const relationship = makeRelationship(RelationshipEndpoint.TARGET);
    const context = makeContext("PLAYER");

    await expect(
      Relationship.sourceEntityId(relationship, {}, context),
    ).resolves.toBe("entity-1");
    await expect(
      Relationship.targetEntityId(relationship, {}, context),
    ).resolves.toBeNull();
  });

  it("nulls out the source instead when that's the concealed side", async () => {
    const relationship = makeRelationship(RelationshipEndpoint.SOURCE);
    const context = makeContext("PLAYER");

    await expect(
      Relationship.sourceEntityId(relationship, {}, context),
    ).resolves.toBeNull();
    await expect(
      Relationship.targetEntityId(relationship, {}, context),
    ).resolves.toBe("entity-2");
  });

  it("returns both real ids to a Player when nothing is concealed", async () => {
    const relationship = makeRelationship(null);
    const context = makeContext("PLAYER");

    await expect(
      Relationship.sourceEntityId(relationship, {}, context),
    ).resolves.toBe("entity-1");
    await expect(
      Relationship.targetEntityId(relationship, {}, context),
    ).resolves.toBe("entity-2");
  });
});

describe("Relationship.concealedEndpoint", () => {
  it("always passes the field through, never redacted", () => {
    const relationship = makeRelationship(RelationshipEndpoint.SOURCE);

    expect(Relationship.concealedEndpoint(relationship)).toBe(
      RelationshipEndpoint.SOURCE,
    );
  });

  it("is null when fully revealed", () => {
    const relationship = makeRelationship(null);

    expect(Relationship.concealedEndpoint(relationship)).toBeNull();
  });
});
