import { describe, expect, it } from "vitest";
import { Relationship } from "@storyforge/domain";
import type { Relationship as PrismaRelationship } from "@storyforge/database";
import { RelationshipMapper } from "./RelationshipMapper";

describe("RelationshipMapper", () => {
  it("maps a persistence record to a domain relationship", () => {
    const record: PrismaRelationship = {
      id: "11111111-1111-1111-1111-111111111111",
      campaignId: "22222222-2222-2222-2222-222222222222",
      sourceEntityId: "33333333-3333-3333-3333-333333333333",
      targetEntityId: "44444444-4444-4444-4444-444444444444",
      type: "ALLY",
      description: "Mutual protection pact",
      createdAt: new Date("2024-01-01T00:00:00Z"),
      updatedAt: new Date("2024-02-01T00:00:00Z"),
      deletedAt: null,
    };

    const relationship = RelationshipMapper.toDomain(record);

    expect(relationship.Id.toString()).toBe(record.id);
    expect(relationship.CampaignId).toBe(record.campaignId);
    expect(relationship.SourceEntityId).toBe(record.sourceEntityId);
    expect(relationship.TargetEntityId).toBe(record.targetEntityId);
    expect(relationship.Type).toBe("ALLY");
    expect(relationship.Description).toBe(record.description);
    expect(relationship.CreatedAt).toEqual(record.createdAt);
    expect(relationship.UpdatedAt).toEqual(record.updatedAt);
    expect(relationship.DeletedAt).toBeNull();
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
      createdAt: relationship.CreatedAt,
      updatedAt: relationship.UpdatedAt,
      deletedAt: relationship.DeletedAt,
    });
  });
});
