import { describe, expect, it } from "vitest";
import { Entity } from "./Entity";
import { EntityCategory } from "./EntityCategory";
import { EntityId } from "./EntityId";
import { EntityVisibility } from "./EntityVisibility";

const validProps = {
  campaignId: "campaign-1",
  type: "npc",
  category: EntityCategory.CHARACTER,
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
    expect(entity.Category).toBe(EntityCategory.CHARACTER);
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
      category: EntityCategory.CHARACTER,
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
      category: validProps.category,
      name: validProps.name,
      description: null,
      icon: null,
      image: null,
      color: null,
      visibility: EntityVisibility.STORYTELLER,
      isPlayerCharacter: false,
      ownerUserId: null,
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

  it("rejects an invalid category", () => {
    expect(() =>
      Entity.create({ ...validProps, category: "PLANET" as EntityCategory }),
    ).toThrow("Entity category is invalid.");
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

  it("changes category", () => {
    const entity = Entity.create(validProps);

    entity.changeCategory(EntityCategory.LOCATION);

    expect(entity.Category).toBe(EntityCategory.LOCATION);
  });

  it("rejects changing to an invalid category", () => {
    const entity = Entity.create(validProps);

    expect(() => entity.changeCategory("PLANET" as EntityCategory)).toThrow(
      "Entity category is invalid.",
    );
  });

  it("defaults isPlayerCharacter to false", () => {
    const entity = Entity.create(validProps);

    expect(entity.IsPlayerCharacter).toBe(false);
  });

  it("creates a Player Character on a CHARACTER-category entity", () => {
    const entity = Entity.create({ ...validProps, isPlayerCharacter: true });

    expect(entity.IsPlayerCharacter).toBe(true);
  });

  it("rejects creating a Player Character on a non-CHARACTER entity", () => {
    expect(() =>
      Entity.create({
        ...validProps,
        category: EntityCategory.LOCATION,
        isPlayerCharacter: true,
      }),
    ).toThrow(
      "Only a CHARACTER-category entity can be marked as a Player Character.",
    );
  });

  it("changes isPlayerCharacter on a CHARACTER-category entity", () => {
    const entity = Entity.create(validProps);

    entity.changeIsPlayerCharacter(true);
    expect(entity.IsPlayerCharacter).toBe(true);

    entity.changeIsPlayerCharacter(false);
    expect(entity.IsPlayerCharacter).toBe(false);
  });

  it("rejects flagging a non-CHARACTER entity as a Player Character", () => {
    const entity = Entity.create({
      ...validProps,
      category: EntityCategory.ITEM,
    });

    expect(() => entity.changeIsPlayerCharacter(true)).toThrow(
      "Only a CHARACTER-category entity can be marked as a Player Character.",
    );
  });

  it("rejects changing category away from CHARACTER while flagged as a Player Character", () => {
    const entity = Entity.create({ ...validProps, isPlayerCharacter: true });

    expect(() => entity.changeCategory(EntityCategory.LOCATION)).toThrow(
      "Only a CHARACTER-category entity can be marked as a Player Character.",
    );
  });

  it("defaults ownerUserId to null", () => {
    const entity = Entity.create(validProps);

    expect(entity.OwnerUserId).toBeNull();
  });

  it("links and unlinks an owner on a Player Character", () => {
    const entity = Entity.create({ ...validProps, isPlayerCharacter: true });

    entity.linkOwner("user-1");
    expect(entity.OwnerUserId).toBe("user-1");

    entity.linkOwner(null);
    expect(entity.OwnerUserId).toBeNull();
  });

  it("rejects linking an owner to a non-Player-Character entity", () => {
    const entity = Entity.create(validProps);

    expect(() => entity.linkOwner("user-1")).toThrow(
      "Only a Player Character can have an owning campaign member.",
    );
  });

  it("clears the owner when isPlayerCharacter is turned off", () => {
    const entity = Entity.create({ ...validProps, isPlayerCharacter: true });
    entity.linkOwner("user-1");

    entity.changeIsPlayerCharacter(false);

    expect(entity.OwnerUserId).toBeNull();
  });

  it("creates a Player Character with an owner set", () => {
    const entity = Entity.create({
      ...validProps,
      isPlayerCharacter: true,
      ownerUserId: "user-1",
    });

    expect(entity.OwnerUserId).toBe("user-1");
  });

  it("rejects creating a non-Player-Character entity with an owner set", () => {
    expect(() =>
      Entity.create({ ...validProps, ownerUserId: "user-1" }),
    ).toThrow("Only a Player Character can have an owning campaign member.");
  });

  it("defaults color to null", () => {
    const entity = Entity.create(validProps);

    expect(entity.Color).toBeNull();
  });

  it("creates an entity with a valid color", () => {
    const entity = Entity.create({ ...validProps, color: "#4287f5" });

    expect(entity.Color).toBe("#4287f5");
  });

  it.each(["blue", "#fff", "#4287f5ff", "4287f5"])(
    "rejects an invalid color %j",
    (color) => {
      expect(() => Entity.create({ ...validProps, color })).toThrow(
        "Entity color must be a 6-digit hex code, e.g. #4287f5.",
      );
    },
  );

  it("changes and clears the color", () => {
    const entity = Entity.create({ ...validProps, color: "#4287f5" });

    entity.changeColor("#c2410c");
    expect(entity.Color).toBe("#c2410c");

    entity.changeColor(null);
    expect(entity.Color).toBeNull();
  });

  it("rejects changing to an invalid color", () => {
    const entity = Entity.create(validProps);

    expect(() => entity.changeColor("not-a-color")).toThrow(
      "Entity color must be a 6-digit hex code, e.g. #4287f5.",
    );
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
