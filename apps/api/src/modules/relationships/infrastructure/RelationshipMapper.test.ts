import { describe, expect, it } from "vitest";
import {
  Relationship,
  RelationshipEndpoint,
  RelationshipVisibility,
} from "@storyforge/domain";
import { RelationshipMapper } from "./RelationshipMapper";
import type { RelationshipRecord } from "./RelationshipMapper";

describe("RelationshipMapper", () => {
  it("maps a persistence record to a domain relationship", () => {
    const record: RelationshipRecord = {
      id: "11111111-1111-1111-1111-111111111111",
      campaignId: "22222222-2222-2222-2222-222222222222",
      sourceEntityId: "33333333-3333-3333-3333-333333333333",
      targetEntityId: "44444444-4444-4444-4444-444444444444",
      type: "ALLY",
      description: "Mutual protection pact",
      visibility: "TARGETED",
      concealedEndpoint: "SOURCE",
      createdAt: new Date("2024-01-01T00:00:00Z"),
      updatedAt: new Date("2024-02-01T00:00:00Z"),
      deletedAt: null,
      recipients: [
        {
          id: "55555555-5555-5555-5555-555555555555",
          relationshipId: "11111111-1111-1111-1111-111111111111",
          userId: "66666666-6666-6666-6666-666666666666",
          createdAt: new Date("2024-01-01T00:00:00Z"),
        },
      ],
    };

    const relationship = RelationshipMapper.toDomain(record);

    expect(relationship.Id.toString()).toBe(record.id);
    expect(relationship.CampaignId).toBe(record.campaignId);
    expect(relationship.SourceEntityId).toBe(record.sourceEntityId);
    expect(relationship.TargetEntityId).toBe(record.targetEntityId);
    expect(relationship.Type).toBe("ALLY");
    expect(relationship.Description).toBe(record.description);
    expect(relationship.Visibility).toBe(RelationshipVisibility.TARGETED);
    expect(relationship.ConcealedEndpoint).toBe(RelationshipEndpoint.SOURCE);
    expect(relationship.RecipientIds.map((id) => id.toString())).toEqual([
      "66666666-6666-6666-6666-666666666666",
    ]);
    expect(relationship.CreatedAt).toEqual(record.createdAt);
    expect(relationship.UpdatedAt).toEqual(record.updatedAt);
    expect(relationship.DeletedAt).toBeNull();
  });

  it("maps a null concealedEndpoint as fully revealed", () => {
    const record: RelationshipRecord = {
      id: "11111111-1111-1111-1111-111111111111",
      campaignId: "22222222-2222-2222-2222-222222222222",
      sourceEntityId: "33333333-3333-3333-3333-333333333333",
      targetEntityId: "44444444-4444-4444-4444-444444444444",
      type: "ALLY",
      description: null,
      visibility: "PUBLIC",
      concealedEndpoint: null,
      createdAt: new Date("2024-01-01T00:00:00Z"),
      updatedAt: new Date("2024-01-01T00:00:00Z"),
      deletedAt: null,
      recipients: [],
    };

    const relationship = RelationshipMapper.toDomain(record);

    expect(relationship.ConcealedEndpoint).toBeNull();
  });

  it("maps a domain relationship to a persistence shape", () => {
    const relationship = Relationship.create({
      campaignId: "22222222-2222-2222-2222-222222222222",
      sourceEntityId: "33333333-3333-3333-3333-333333333333",
      targetEntityId: "44444444-4444-4444-4444-444444444444",
      type: "ENEMY",
      description: "Blood feud",
    });

    const record = RelationshipMapper.toPersistence(relationship);

    expect(record).toEqual({
      id: relationship.Id.toString(),
      campaignId: relationship.CampaignId,
      sourceEntityId: relationship.SourceEntityId,
      targetEntityId: relationship.TargetEntityId,
      type: relationship.Type,
      description: relationship.Description,
      visibility: relationship.Visibility,
      concealedEndpoint: relationship.ConcealedEndpoint,
      createdAt: relationship.CreatedAt,
      updatedAt: relationship.UpdatedAt,
      deletedAt: relationship.DeletedAt,
    });
  });

  it("carries a concealed endpoint through to the persistence shape", () => {
    const relationship = Relationship.create({
      campaignId: "22222222-2222-2222-2222-222222222222",
      sourceEntityId: "33333333-3333-3333-3333-333333333333",
      targetEntityId: "44444444-4444-4444-4444-444444444444",
      type: "ENEMY",
      concealedEndpoint: RelationshipEndpoint.TARGET,
    });

    const record = RelationshipMapper.toPersistence(relationship);

    expect(record.concealedEndpoint).toBe(RelationshipEndpoint.TARGET);
  });
});
