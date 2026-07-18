import { afterEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { Territory, TerritoryId } from "@storyforge/domain";
import { prisma } from "@storyforge/database";
import { PrismaTerritoryRepository } from "./PrismaTerritoryRepository";

const repository = new PrismaTerritoryRepository();
const createdCampaignIds: string[] = [];

const geometry = {
  type: "Polygon",
  coordinates: [
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
      [0, 0],
    ],
  ],
};

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

describe("PrismaTerritoryRepository", () => {
  it("creates a territory and finds it by id", async () => {
    const campaignId = await createCampaign();
    const territory = Territory.create({
      campaignId,
      name: "Thornwood",
      type: "region",
      geometry,
    });

    await repository.create(territory);
    const found = await repository.findById(territory.Id);

    expect(found).not.toBeNull();
    expect(found?.Id.equals(territory.Id)).toBe(true);
    expect(found?.CampaignId).toBe(campaignId);
    expect(found?.Name).toBe("Thornwood");
    expect(found?.Geometry).toEqual(geometry);
  });

  it("returns null when the territory does not exist", async () => {
    const found = await repository.findById(TerritoryId.create());

    expect(found).toBeNull();
  });

  it("lists territories for a campaign", async () => {
    const campaignId = await createCampaign();
    const first = Territory.create({
      campaignId,
      name: "Thornwood",
      type: "region",
      geometry,
    });
    const second = Territory.create({
      campaignId,
      name: "Old Town",
      type: "district",
      geometry,
    });
    await repository.create(first);
    await repository.create(second);

    const territories = await repository.findByCampaign(campaignId);

    expect(territories.map((t) => t.Id.toString()).sort()).toEqual(
      [first.Id.toString(), second.Id.toString()].sort(),
    );
  });

  it("updates a territory", async () => {
    const campaignId = await createCampaign();
    const territory = Territory.create({
      campaignId,
      name: "Thornwood",
      type: "region",
      geometry,
    });
    await repository.create(territory);

    territory.rename("Blackwood");
    territory.changeType("district");
    await repository.update(territory);

    const found = await repository.findById(territory.Id);
    expect(found?.Name).toBe("Blackwood");
    expect(found?.Type).toBe("district");
  });

  it("deletes a territory", async () => {
    const campaignId = await createCampaign();
    const territory = Territory.create({
      campaignId,
      name: "Thornwood",
      type: "region",
      geometry,
    });
    await repository.create(territory);

    await repository.delete(territory.Id);

    const found = await repository.findById(territory.Id);
    expect(found).toBeNull();
  });
});
