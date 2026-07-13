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

async function createTag(campaignId: string, name: string): Promise<string> {
  const tag = await prisma.tag.create({
    data: { id: randomUUID(), campaignId, name },
  });
  return tag.id;
}

async function attachTag(entityId: string, tagId: string): Promise<void> {
  await prisma.entityTag.create({
    data: { id: randomUUID(), entityId, tagId },
  });
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

  describe("findByCampaign filtering", () => {
    it("filters by type", async () => {
      const campaignId = await createCampaign();
      const npc = Entity.create({
        campaignId,
        type: "npc",
        name: uniqueName(),
        visibility: EntityVisibility.PUBLIC,
      });
      const location = Entity.create({
        campaignId,
        type: "location",
        name: uniqueName(),
        visibility: EntityVisibility.PUBLIC,
      });
      await repository.create(npc);
      await repository.create(location);

      const entities = await repository.findByCampaign(campaignId, {
        type: "npc",
      });

      expect(entities.map((e) => e.Id.toString())).toEqual([npc.Id.toString()]);
    });

    it("filters by nameContains, case-insensitively", async () => {
      const campaignId = await createCampaign();
      const goblin = Entity.create({
        campaignId,
        type: "npc",
        name: `Goblin-${randomUUID()}`,
        visibility: EntityVisibility.PUBLIC,
      });
      const orc = Entity.create({
        campaignId,
        type: "npc",
        name: `Orc-${randomUUID()}`,
        visibility: EntityVisibility.PUBLIC,
      });
      await repository.create(goblin);
      await repository.create(orc);

      const matches = await repository.findByCampaign(campaignId, {
        nameContains: "OBL",
      });
      const noMatches = await repository.findByCampaign(campaignId, {
        nameContains: "zzz-no-match",
      });

      expect(matches.map((e) => e.Id.toString())).toEqual([
        goblin.Id.toString(),
      ]);
      expect(noMatches).toEqual([]);
    });

    it("filters by tagIds with any-match semantics and no duplicates", async () => {
      const campaignId = await createCampaign();
      const tag1 = await createTag(campaignId, `tag1-${randomUUID()}`);
      const tag2 = await createTag(campaignId, `tag2-${randomUUID()}`);
      const taggedWithBoth = Entity.create({
        campaignId,
        type: "npc",
        name: uniqueName(),
        visibility: EntityVisibility.PUBLIC,
      });
      const taggedWithOther = Entity.create({
        campaignId,
        type: "npc",
        name: uniqueName(),
        visibility: EntityVisibility.PUBLIC,
      });
      const untagged = Entity.create({
        campaignId,
        type: "npc",
        name: uniqueName(),
        visibility: EntityVisibility.PUBLIC,
      });
      await repository.create(taggedWithBoth);
      await repository.create(taggedWithOther);
      await repository.create(untagged);
      await attachTag(taggedWithBoth.Id.toString(), tag1);
      await attachTag(taggedWithBoth.Id.toString(), tag2);
      await attachTag(taggedWithOther.Id.toString(), tag2);

      const entities = await repository.findByCampaign(campaignId, {
        tagIds: [tag1],
      });

      expect(entities.map((e) => e.Id.toString())).toEqual([
        taggedWithBoth.Id.toString(),
      ]);
    });

    it("combines type and nameContains with AND semantics", async () => {
      const campaignId = await createCampaign();
      const matching = Entity.create({
        campaignId,
        type: "npc",
        name: `Goblin-${randomUUID()}`,
        visibility: EntityVisibility.PUBLIC,
      });
      const wrongType = Entity.create({
        campaignId,
        type: "location",
        name: `Goblin-${randomUUID()}`,
        visibility: EntityVisibility.PUBLIC,
      });
      const wrongName = Entity.create({
        campaignId,
        type: "npc",
        name: `Orc-${randomUUID()}`,
        visibility: EntityVisibility.PUBLIC,
      });
      await repository.create(matching);
      await repository.create(wrongType);
      await repository.create(wrongName);

      const entities = await repository.findByCampaign(campaignId, {
        type: "npc",
        nameContains: "goblin",
      });

      expect(entities.map((e) => e.Id.toString())).toEqual([
        matching.Id.toString(),
      ]);
    });

    it("excludes soft-deleted entities even when a filter is applied", async () => {
      const campaignId = await createCampaign();
      const deleted = Entity.create({
        campaignId,
        type: "npc",
        name: uniqueName(),
        visibility: EntityVisibility.PUBLIC,
      });
      deleted.delete();
      await repository.create(deleted);

      const entities = await repository.findByCampaign(campaignId, {
        type: "npc",
      });

      expect(entities.some((e) => e.Id.equals(deleted.Id))).toBe(false);
    });
  });
});
