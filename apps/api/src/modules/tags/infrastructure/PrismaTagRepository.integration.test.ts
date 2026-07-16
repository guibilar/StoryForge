import { afterEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { Entity, EntityVisibility, Tag, TagId } from "@storyforge/domain";
import { prisma } from "@storyforge/database";
import { PrismaEntityRepository } from "../../entities/infrastructure/PrismaEntityRepository";
import { PrismaTagRepository } from "./PrismaTagRepository";

const repository = new PrismaTagRepository();
const entityRepository = new PrismaEntityRepository();
const createdCampaignIds: string[] = [];

function uniqueName(prefix: string): string {
  return `${prefix}-${randomUUID()}`;
}

async function createCampaign(): Promise<string> {
  const campaign = await prisma.campaign.create({
    data: { id: randomUUID(), name: uniqueName("test-campaign") },
  });
  createdCampaignIds.push(campaign.id);
  return campaign.id;
}

async function createEntity(campaignId: string) {
  const entity = Entity.create({
    campaignId,
    type: "npc",
    name: uniqueName("test-entity"),
    visibility: EntityVisibility.PUBLIC,
  });
  await entityRepository.create(entity);
  return entity;
}

afterEach(async () => {
  if (createdCampaignIds.length > 0) {
    await prisma.campaign.deleteMany({
      where: { id: { in: createdCampaignIds } },
    });
    createdCampaignIds.length = 0;
  }
});

describe("PrismaTagRepository", () => {
  it("creates a tag and finds it by id", async () => {
    const campaignId = await createCampaign();
    const tag = Tag.create({ campaignId, name: uniqueName("tag") });

    await repository.create(tag);
    const found = await repository.findById(tag.Id);

    expect(found).not.toBeNull();
    expect(found?.Id.equals(tag.Id)).toBe(true);
    expect(found?.CampaignId).toBe(campaignId);
  });

  it("returns null when the tag does not exist", async () => {
    const found = await repository.findById(TagId.create());

    expect(found).toBeNull();
  });

  it("lists tags for a campaign", async () => {
    const campaignId = await createCampaign();
    const tag = Tag.create({ campaignId, name: uniqueName("tag") });
    await repository.create(tag);

    const tags = await repository.findByCampaign(campaignId);

    expect(tags.some((t) => t.Id.equals(tag.Id))).toBe(true);
  });

  it("finds a tag by campaign and name", async () => {
    const campaignId = await createCampaign();
    const name = uniqueName("tag");
    const tag = Tag.create({ campaignId, name });
    await repository.create(tag);

    const found = await repository.findByCampaignAndName(campaignId, name);

    expect(found?.Id.equals(tag.Id)).toBe(true);
    await expect(
      repository.findByCampaignAndName(campaignId, uniqueName("tag")),
    ).resolves.toBeNull();
  });

  it("attaches and detaches a tag from an entity idempotently", async () => {
    const campaignId = await createCampaign();
    const entity = await createEntity(campaignId);
    const tag = Tag.create({ campaignId, name: uniqueName("tag") });
    await repository.create(tag);

    await repository.attachToEntity(tag.Id, entity.Id.toString());
    await repository.attachToEntity(tag.Id, entity.Id.toString()); // idempotent, no duplicate link

    const tagsForEntity = await repository.findByEntity(entity.Id.toString());
    expect(tagsForEntity.filter((t) => t.Id.equals(tag.Id))).toHaveLength(1);

    await repository.detachFromEntity(tag.Id, entity.Id.toString());
    await repository.detachFromEntity(tag.Id, entity.Id.toString()); // idempotent, no error

    const afterDetach = await repository.findByEntity(entity.Id.toString());
    expect(afterDetach.some((t) => t.Id.equals(tag.Id))).toBe(false);
  });
});
