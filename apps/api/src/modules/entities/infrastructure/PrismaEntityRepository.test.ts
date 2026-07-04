import { afterEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { Entity, EntityId, EntityVisibility } from "@storyforge/domain";
import { prisma } from "@storyforge/database";
import { PrismaEntityRepository } from "./PrismaEntityRepository";

const repository = new PrismaEntityRepository();
const createdCampaignIds: string[] = [];

function uniqueName(): string {
  return `test-entity-${randomUUID()}`;
}

async function createCampaign(): Promise<string> {
  const campaign = await prisma.campaign.create({
    data: { id: randomUUID(), name: `test-campaign-${randomUUID()}` },
  });
  createdCampaignIds.push(campaign.id);
  return campaign.id;
}

afterEach(async () => {
  if (createdCampaignIds.length > 0) {
    await prisma.campaign.deleteMany({
      where: { id: { in: createdCampaignIds } },
    });
    createdCampaignIds.length = 0;
  }
});

describe("PrismaEntityRepository", () => {
  it("creates an entity and finds it by id", async () => {
    const campaignId = await createCampaign();
    const entity = Entity.create({
      campaignId,
      type: "npc",
      name: uniqueName(),
      visibility: EntityVisibility.PUBLIC,
    });

    await repository.create(entity);
    const found = await repository.findById(entity.Id);

    expect(found).not.toBeNull();
    expect(found?.Id.equals(entity.Id)).toBe(true);
    expect(found?.CampaignId).toBe(campaignId);
  });

  it("returns null when the entity does not exist", async () => {
    const found = await repository.findById(EntityId.create());

    expect(found).toBeNull();
  });

  it("lists entities for a campaign, excluding soft-deleted ones", async () => {
    const campaignId = await createCampaign();
    const kept = Entity.create({
      campaignId,
      type: "npc",
      name: uniqueName(),
      visibility: EntityVisibility.PUBLIC,
    });
    const deleted = Entity.create({
      campaignId,
      type: "npc",
      name: uniqueName(),
      visibility: EntityVisibility.PUBLIC,
    });
    deleted.delete();
    await repository.create(kept);
    await repository.create(deleted);

    const entities = await repository.findByCampaign(campaignId);

    expect(entities.some((e) => e.Id.equals(kept.Id))).toBe(true);
    expect(entities.some((e) => e.Id.equals(deleted.Id))).toBe(false);
  });

  it("reports whether a name already exists in the campaign", async () => {
    const campaignId = await createCampaign();
    const name = uniqueName();
    const entity = Entity.create({
      campaignId,
      type: "npc",
      name,
      visibility: EntityVisibility.PUBLIC,
    });
    await repository.create(entity);

    await expect(repository.existsByName(campaignId, name)).resolves.toBe(true);
    await expect(
      repository.existsByName(campaignId, uniqueName()),
    ).resolves.toBe(false);
  });

  it("updates an entity", async () => {
    const campaignId = await createCampaign();
    const entity = Entity.create({
      campaignId,
      type: "npc",
      name: uniqueName(),
      visibility: EntityVisibility.PUBLIC,
    });
    await repository.create(entity);

    entity.rename(uniqueName());
    entity.changeVisibility(EntityVisibility.PRIVATE);
    await repository.update(entity);

    const found = await repository.findById(entity.Id);
    expect(found?.Name).toBe(entity.Name);
    expect(found?.Visibility).toBe(EntityVisibility.PRIVATE);
  });
});
