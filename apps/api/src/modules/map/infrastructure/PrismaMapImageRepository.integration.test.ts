import { afterEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { MapImage } from "@storyforge/domain";
import { prisma } from "@storyforge/database";
import { PrismaMapImageRepository } from "./PrismaMapImageRepository";

const repository = new PrismaMapImageRepository();
const createdCampaignIds: string[] = [];

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

describe("PrismaMapImageRepository", () => {
  it("upserts a map image and finds it by campaign", async () => {
    const campaignId = await createCampaign();
    const mapImage = MapImage.create({
      campaignId,
      url: `/uploads/${campaignId}/first.png`,
      fileName: "fantasy-map.png",
      mimeType: "image/png",
      sizeBytes: 1000,
      width: 2000,
      height: 1500,
    });

    await repository.upsert(mapImage);
    const found = await repository.findByCampaign(campaignId);

    expect(found).not.toBeNull();
    expect(found?.Id.equals(mapImage.Id)).toBe(true);
    expect(found?.Url).toBe(mapImage.Url);
    expect(found?.Width).toBe(2000);
  });

  it("returns null when the campaign has no map image", async () => {
    const campaignId = await createCampaign();

    await expect(repository.findByCampaign(campaignId)).resolves.toBeNull();
  });

  it("upserts in place when replacing an existing map image", async () => {
    const campaignId = await createCampaign();
    const mapImage = MapImage.create({
      campaignId,
      url: `/uploads/${campaignId}/first.png`,
      fileName: "fantasy-map.png",
      mimeType: "image/png",
      sizeBytes: 1000,
      width: 2000,
      height: 1500,
    });
    await repository.upsert(mapImage);

    mapImage.replaceImage({
      url: `/uploads/${campaignId}/second.png`,
      fileName: "new-map.png",
      mimeType: "image/webp",
      sizeBytes: 500,
      width: 800,
      height: 600,
    });
    await repository.upsert(mapImage);

    const found = await repository.findByCampaign(campaignId);
    expect(found?.Id.equals(mapImage.Id)).toBe(true);
    expect(found?.Url).toBe(`/uploads/${campaignId}/second.png`);
    expect(found?.Width).toBe(800);
  });

  it("deletes a map image by campaign", async () => {
    const campaignId = await createCampaign();
    const mapImage = MapImage.create({
      campaignId,
      url: `/uploads/${campaignId}/first.png`,
      fileName: "fantasy-map.png",
      mimeType: "image/png",
      sizeBytes: 1000,
      width: 2000,
      height: 1500,
    });
    await repository.upsert(mapImage);

    await repository.deleteByCampaign(campaignId);

    await expect(repository.findByCampaign(campaignId)).resolves.toBeNull();
  });
});
