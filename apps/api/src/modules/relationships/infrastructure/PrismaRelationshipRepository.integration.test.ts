import { afterEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { Relationship, RelationshipId } from "@storyforge/domain";
import { prisma } from "@storyforge/database";
import { PrismaRelationshipRepository } from "./PrismaRelationshipRepository";

const repository = new PrismaRelationshipRepository();
const createdCampaignIds: string[] = [];

async function createCampaign(): Promise<string> {
  const campaign = await prisma.campaign.create({
    data: { id: randomUUID(), name: `test-campaign-${randomUUID()}` },
  });
  createdCampaignIds.push(campaign.id);
  return campaign.id;
}

async function createEntity(campaignId: string): Promise<string> {
  const entity = await prisma.entity.create({
    data: {
      id: randomUUID(),
      campaignId,
      type: "npc",
      name: `test-entity-${randomUUID()}`,
      visibility: "PUBLIC",
    },
  });
  return entity.id;
}

afterEach(async () => {
  if (createdCampaignIds.length > 0) {
    await prisma.campaign.deleteMany({
      where: { id: { in: createdCampaignIds } },
    });
    createdCampaignIds.length = 0;
  }
});

describe("PrismaRelationshipRepository", () => {
  it("creates a relationship and finds it by id", async () => {
    const campaignId = await createCampaign();
    const sourceEntityId = await createEntity(campaignId);
    const targetEntityId = await createEntity(campaignId);
    const relationship = Relationship.create({
      campaignId,
      sourceEntityId,
      targetEntityId,
      type: "ALLY",
    });

    await repository.create(relationship);
    const found = await repository.findById(relationship.Id);

    expect(found).not.toBeNull();
    expect(found?.Id.equals(relationship.Id)).toBe(true);
    expect(found?.CampaignId).toBe(campaignId);
    expect(found?.Type).toBe("ALLY");
  });

  it("returns null when the relationship does not exist", async () => {
    const found = await repository.findById(RelationshipId.create());

    expect(found).toBeNull();
  });

  it("returns null for a soft-deleted relationship", async () => {
    const campaignId = await createCampaign();
    const a = await createEntity(campaignId);
    const b = await createEntity(campaignId);
    const relationship = Relationship.create({
      campaignId,
      sourceEntityId: a,
      targetEntityId: b,
      type: "ALLY",
    });
    await repository.create(relationship);
    relationship.delete();
    await repository.update(relationship);

    const found = await repository.findById(relationship.Id);

    expect(found).toBeNull();
  });

  it("lists relationships for a campaign, excluding soft-deleted ones", async () => {
    const campaignId = await createCampaign();
    const a = await createEntity(campaignId);
    const b = await createEntity(campaignId);
    const c = await createEntity(campaignId);
    const kept = Relationship.create({
      campaignId,
      sourceEntityId: a,
      targetEntityId: b,
      type: "ALLY",
    });
    const deleted = Relationship.create({
      campaignId,
      sourceEntityId: a,
      targetEntityId: c,
      type: "ENEMY",
    });
    deleted.delete();
    await repository.create(kept);
    await repository.create(deleted);

    const relationships = await repository.findByCampaign(campaignId);

    expect(relationships.some((r) => r.Id.equals(kept.Id))).toBe(true);
    expect(relationships.some((r) => r.Id.equals(deleted.Id))).toBe(false);
  });

  it("finds relationships by entity, matching either source or target", async () => {
    const campaignId = await createCampaign();
    const a = await createEntity(campaignId);
    const b = await createEntity(campaignId);
    const c = await createEntity(campaignId);
    const asSource = Relationship.create({
      campaignId,
      sourceEntityId: a,
      targetEntityId: b,
      type: "MEMBER_OF",
    });
    const asTarget = Relationship.create({
      campaignId,
      sourceEntityId: c,
      targetEntityId: a,
      type: "OWNS",
    });
    const unrelated = Relationship.create({
      campaignId,
      sourceEntityId: b,
      targetEntityId: c,
      type: "PARENT",
    });
    await repository.create(asSource);
    await repository.create(asTarget);
    await repository.create(unrelated);

    const relationships = await repository.findByEntity(campaignId, a);

    expect(relationships.map((r) => r.Id.toString()).sort()).toEqual(
      [asSource.Id.toString(), asTarget.Id.toString()].sort(),
    );
  });

  it("does not return relationships from a different campaign for the same entity id", async () => {
    const campaignId = await createCampaign();
    const otherCampaignId = await createCampaign();
    const a = await createEntity(campaignId);
    const b = await createEntity(campaignId);
    const relationship = Relationship.create({
      campaignId,
      sourceEntityId: a,
      targetEntityId: b,
      type: "MEMBER_OF",
    });
    await repository.create(relationship);

    const relationships = await repository.findByEntity(otherCampaignId, a);

    expect(relationships).toEqual([]);
  });

  it("reports whether an edge already exists", async () => {
    const campaignId = await createCampaign();
    const a = await createEntity(campaignId);
    const b = await createEntity(campaignId);
    const relationship = Relationship.create({
      campaignId,
      sourceEntityId: a,
      targetEntityId: b,
      type: "CHILD",
    });
    await repository.create(relationship);

    await expect(
      repository.existsByEdge(campaignId, a, b, "CHILD"),
    ).resolves.toBe(true);
    await expect(
      repository.existsByEdge(campaignId, a, b, "ALLY"),
    ).resolves.toBe(false);
  });

  it("ignores a soft-deleted edge, allowing the same edge to be recreated", async () => {
    const campaignId = await createCampaign();
    const a = await createEntity(campaignId);
    const b = await createEntity(campaignId);
    const relationship = Relationship.create({
      campaignId,
      sourceEntityId: a,
      targetEntityId: b,
      type: "ALLY",
    });
    await repository.create(relationship);
    relationship.delete();
    await repository.update(relationship);

    await expect(
      repository.existsByEdge(campaignId, a, b, "ALLY"),
    ).resolves.toBe(false);

    const recreated = Relationship.create({
      campaignId,
      sourceEntityId: a,
      targetEntityId: b,
      type: "ALLY",
    });
    await expect(repository.create(recreated)).resolves.not.toThrow();
  });

  it("updates a relationship", async () => {
    const campaignId = await createCampaign();
    const a = await createEntity(campaignId);
    const b = await createEntity(campaignId);
    const relationship = Relationship.create({
      campaignId,
      sourceEntityId: a,
      targetEntityId: b,
      type: "ALLY",
    });
    await repository.create(relationship);

    relationship.changeType("ENEMY");
    relationship.changeDescription("Turned hostile");
    await repository.update(relationship);

    const found = await repository.findById(relationship.Id);
    expect(found?.Type).toBe("ENEMY");
    expect(found?.Description).toBe("Turned hostile");
  });

  it("excludes a soft-deleted relationship from findByCampaign", async () => {
    const campaignId = await createCampaign();
    const a = await createEntity(campaignId);
    const b = await createEntity(campaignId);
    const relationship = Relationship.create({
      campaignId,
      sourceEntityId: a,
      targetEntityId: b,
      type: "ALLY",
    });
    await repository.create(relationship);
    relationship.delete();
    await repository.update(relationship);

    const relationships = await repository.findByCampaign(campaignId);

    expect(relationships.some((r) => r.Id.equals(relationship.Id))).toBe(false);
  });
});
