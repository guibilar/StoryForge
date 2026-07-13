import { describe, expect, it } from "vitest";
import { Relationship } from "./Relationship";
import { RelationshipId } from "./RelationshipId";

const validProps = {
  campaignId: "campaign-1",
  sourceEntityId: "entity-1",
  targetEntityId: "entity-2",
  type: "Ally",
  description: "Mutual protection pact",
};

describe("Relationship", () => {
  it("creates a relationship with defaults", () => {
    const relationship = Relationship.create(validProps);

    expect(relationship.CampaignId).toBe(validProps.campaignId);
    expect(relationship.SourceEntityId).toBe(validProps.sourceEntityId);
    expect(relationship.TargetEntityId).toBe(validProps.targetEntityId);
    expect(relationship.Type).toBe(validProps.type);
    expect(relationship.Description).toBe(validProps.description);
    expect(relationship.DeletedAt).toBeNull();
    expect(relationship.isDeleted()).toBe(false);
  });

  it("defaults description to null when omitted", () => {
    const relationship = Relationship.create({
      campaignId: "campaign-1",
      sourceEntityId: "entity-1",
      targetEntityId: "entity-2",
      type: "Enemy",
    });

    expect(relationship.Description).toBeNull();
  });

  it("rehydrates preserving id and timestamps", () => {
    const id = RelationshipId.create();
    const createdAt = new Date("2024-01-01T00:00:00Z");
    const updatedAt = new Date("2024-02-01T00:00:00Z");

    const relationship = Relationship.rehydrate({
      id,
      campaignId: validProps.campaignId,
      sourceEntityId: validProps.sourceEntityId,
      targetEntityId: validProps.targetEntityId,
      type: validProps.type,
      description: null,
      createdAt,
      updatedAt,
      deletedAt: null,
    });

    expect(relationship.Id.equals(id)).toBe(true);
    expect(relationship.CreatedAt).toBe(createdAt);
    expect(relationship.UpdatedAt).toBe(updatedAt);
  });

  it("rejects a self-relationship", () => {
    expect(() =>
      Relationship.create({
        ...validProps,
        sourceEntityId: "entity-1",
        targetEntityId: "entity-1",
      }),
    ).toThrow("Relationship source and target cannot be the same entity.");
  });

  it.each(["", "   "])("rejects an empty type %j", (type) => {
    expect(() => Relationship.create({ ...validProps, type })).toThrow(
      "Relationship type is required.",
    );
  });

  it("rejects a type longer than 100 characters", () => {
    expect(() =>
      Relationship.create({ ...validProps, type: "a".repeat(101) }),
    ).toThrow("Relationship type is too long.");
  });

  it("rejects a description longer than 1000 characters", () => {
    expect(() =>
      Relationship.create({ ...validProps, description: "a".repeat(1001) }),
    ).toThrow("Relationship description cannot exceed 1000 characters.");
  });

  it("changes type and description", () => {
    const relationship = Relationship.create(validProps);

    relationship.changeType("Rival");
    relationship.changeDescription("New description");

    expect(relationship.Type).toBe("Rival");
    expect(relationship.Description).toBe("New description");
  });

  it("trims the type on change", () => {
    const relationship = Relationship.create(validProps);

    relationship.changeType("  Rival  ");

    expect(relationship.Type).toBe("Rival");
  });

  it("soft-deletes and restores", () => {
    const relationship = Relationship.create(validProps);

    relationship.delete();
    expect(relationship.isDeleted()).toBe(true);
    expect(relationship.DeletedAt).toBeInstanceOf(Date);

    relationship.restore();
    expect(relationship.isDeleted()).toBe(false);
    expect(relationship.DeletedAt).toBeNull();
  });

  it("deleting twice keeps the original deletedAt", () => {
    const relationship = Relationship.create(validProps);

    relationship.delete();
    const firstDeletedAt = relationship.DeletedAt;
    relationship.delete();

    expect(relationship.DeletedAt).toBe(firstDeletedAt);
  });
});
