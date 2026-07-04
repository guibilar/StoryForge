import { describe, expect, it } from "vitest";
import { Entity, EntityVisibility } from "@storyforge/domain";
import type { Entity as PrismaEntity } from "@storyforge/database";
import { EntityMapper } from "./EntityMapper";

describe("EntityMapper", () => {
  it("maps a persistence record to a domain entity", () => {
    const record: PrismaEntity = {
      id: "11111111-1111-1111-1111-111111111111",
      campaignId: "22222222-2222-2222-2222-222222222222",
      type: "npc",
      name: "Goblin",
      description: "A sneaky goblin",
      icon: "goblin.png",
      visibility: "PRIVATE",
      createdAt: new Date("2024-01-01T00:00:00Z"),
      updatedAt: new Date("2024-02-01T00:00:00Z"),
      deletedAt: null,
    };

    const entity = EntityMapper.toDomain(record);

    expect(entity.Id.toString()).toBe(record.id);
    expect(entity.CampaignId).toBe(record.campaignId);
    expect(entity.Type).toBe(record.type);
    expect(entity.Name).toBe(record.name);
    expect(entity.Description).toBe(record.description);
    expect(entity.Icon).toBe(record.icon);
    expect(entity.Visibility).toBe(EntityVisibility.PRIVATE);
    expect(entity.CreatedAt).toEqual(record.createdAt);
    expect(entity.UpdatedAt).toEqual(record.updatedAt);
    expect(entity.DeletedAt).toBeNull();
  });

  it("maps a domain entity to a persistence shape", () => {
    const entity = Entity.create({
      campaignId: "22222222-2222-2222-2222-222222222222",
      type: "npc",
      name: "Goblin",
      description: "A sneaky goblin",
      icon: "goblin.png",
      visibility: EntityVisibility.PUBLIC,
    });

    const record = EntityMapper.toPersistence(entity);

    expect(record).toEqual({
      id: entity.Id.toString(),
      campaignId: entity.CampaignId,
      type: entity.Type,
      name: entity.Name,
      description: entity.Description,
      icon: entity.Icon,
      visibility: entity.Visibility,
      createdAt: entity.CreatedAt,
      updatedAt: entity.UpdatedAt,
      deletedAt: entity.DeletedAt,
    });
  });
});
