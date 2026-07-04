import { describe, expect, it } from "vitest";
import { Entity } from "./Entity";
import { EntityId } from "./EntityId";
import { EntityVisibility } from "./EntityVisibility";

const validProps = {
  campaignId: "campaign-1",
  type: "npc",
  name: "Goblin",
  description: "A sneaky goblin",
  icon: "goblin.png",
  visibility: EntityVisibility.PUBLIC,
};

describe("Entity", () => {
  it("creates an entity with defaults", () => {
    const entity = Entity.create(validProps);

    expect(entity.CampaignId).toBe(validProps.campaignId);
    expect(entity.Type).toBe(validProps.type);
    expect(entity.Name).toBe(validProps.name);
    expect(entity.Description).toBe(validProps.description);
    expect(entity.Icon).toBe(validProps.icon);
    expect(entity.Visibility).toBe(EntityVisibility.PUBLIC);
    expect(entity.DeletedAt).toBeNull();
    expect(entity.isDeleted()).toBe(false);
  });

  it("defaults description and icon to null when omitted", () => {
    const entity = Entity.create({
      campaignId: "campaign-1",
      type: "npc",
      name: "Goblin",
      visibility: EntityVisibility.PRIVATE,
    });

    expect(entity.Description).toBeNull();
    expect(entity.Icon).toBeNull();
  });

  it("rehydrates preserving id and timestamps", () => {
    const id = EntityId.create();
    const createdAt = new Date("2024-01-01T00:00:00Z");
    const updatedAt = new Date("2024-02-01T00:00:00Z");

    const entity = Entity.rehydrate({
      id,
      campaignId: validProps.campaignId,
      type: validProps.type,
      name: validProps.name,
      description: null,
      icon: null,
      visibility: EntityVisibility.STORYTELLER,
      createdAt,
      updatedAt,
      deletedAt: null,
    });

    expect(entity.Id.equals(id)).toBe(true);
    expect(entity.CreatedAt).toBe(createdAt);
    expect(entity.UpdatedAt).toBe(updatedAt);
  });

  it.each(["", "   "])("rejects an empty name %j", (name) => {
    expect(() => Entity.create({ ...validProps, name })).toThrow(
      "Entity name cannot be empty.",
    );
  });

  it("rejects a name longer than 255 characters", () => {
    expect(() =>
      Entity.create({ ...validProps, name: "a".repeat(256) }),
    ).toThrow("Entity name cannot exceed 255 characters.");
  });

  it("rejects a description longer than 1000 characters", () => {
    expect(() =>
      Entity.create({ ...validProps, description: "a".repeat(1001) }),
    ).toThrow("Entity description cannot exceed 1000 characters.");
  });

  it.each(["", "   "])("rejects an empty type %j", (type) => {
    expect(() => Entity.create({ ...validProps, type })).toThrow(
      "Entity type is required.",
    );
  });

  it("rejects a type longer than 100 characters", () => {
    expect(() =>
      Entity.create({ ...validProps, type: "a".repeat(101) }),
    ).toThrow("Entity type is too long.");
  });

  it("trims the name on rename", () => {
    const entity = Entity.create(validProps);

    entity.rename("  New Name  ");

    expect(entity.Name).toBe("New Name");
  });

  it("changes description, icon and visibility", () => {
    const entity = Entity.create(validProps);

    entity.changeDescription("New description");
    entity.changeIcon("new-icon.png");
    entity.changeVisibility(EntityVisibility.PRIVATE);

    expect(entity.Description).toBe("New description");
    expect(entity.Icon).toBe("new-icon.png");
    expect(entity.Visibility).toBe(EntityVisibility.PRIVATE);
  });

  it("soft-deletes and restores", () => {
    const entity = Entity.create(validProps);

    entity.delete();
    expect(entity.isDeleted()).toBe(true);
    expect(entity.DeletedAt).toBeInstanceOf(Date);

    entity.restore();
    expect(entity.isDeleted()).toBe(false);
    expect(entity.DeletedAt).toBeNull();
  });

  it("deleting twice keeps the original deletedAt", () => {
    const entity = Entity.create(validProps);

    entity.delete();
    const firstDeletedAt = entity.DeletedAt;
    entity.delete();

    expect(entity.DeletedAt).toBe(firstDeletedAt);
  });
});
