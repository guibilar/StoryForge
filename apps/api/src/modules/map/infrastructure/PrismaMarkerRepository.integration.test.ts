import { afterEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { Marker, MarkerId } from "@storyforge/domain";
import { prisma } from "@storyforge/database";
import { PrismaMarkerRepository } from "./PrismaMarkerRepository";

const repository = new PrismaMarkerRepository();
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

describe("PrismaMarkerRepository", () => {
  it("creates a marker and finds it by id", async () => {
    const campaignId = await createCampaign();
    const marker = Marker.create({
      campaignId,
      name: "Old Mill",
      lat: 51.505,
      lng: -0.09,
    });

    await repository.create(marker);
    const found = await repository.findById(marker.Id);

    expect(found).not.toBeNull();
    expect(found?.Id.equals(marker.Id)).toBe(true);
    expect(found?.CampaignId).toBe(campaignId);
    expect(found?.Name).toBe("Old Mill");
  });

  it("returns null when the marker does not exist", async () => {
    const found = await repository.findById(MarkerId.create());

    expect(found).toBeNull();
  });

  it("lists markers for a campaign", async () => {
    const campaignId = await createCampaign();
    const first = Marker.create({
      campaignId,
      name: "Old Mill",
      lat: 1,
      lng: 1,
    });
    const second = Marker.create({
      campaignId,
      name: "Ambush site",
      lat: 2,
      lng: 2,
    });
    await repository.create(first);
    await repository.create(second);

    const markers = await repository.findByCampaign(campaignId);

    expect(markers.map((m) => m.Id.toString()).sort()).toEqual(
      [first.Id.toString(), second.Id.toString()].sort(),
    );
  });

  it("updates a marker", async () => {
    const campaignId = await createCampaign();
    const marker = Marker.create({
      campaignId,
      name: "Old Mill",
      lat: 1,
      lng: 1,
    });
    await repository.create(marker);

    marker.rename("New Mill");
    marker.moveTo(5, 6);
    await repository.update(marker);

    const found = await repository.findById(marker.Id);
    expect(found?.Name).toBe("New Mill");
    expect(found?.Lat).toBe(5);
    expect(found?.Lng).toBe(6);
  });

  it("deletes a marker", async () => {
    const campaignId = await createCampaign();
    const marker = Marker.create({
      campaignId,
      name: "Old Mill",
      lat: 1,
      lng: 1,
    });
    await repository.create(marker);

    await repository.delete(marker.Id);

    const found = await repository.findById(marker.Id);
    expect(found).toBeNull();
  });

  describe("entity link", () => {
    async function createEntity(campaignId: string): Promise<string> {
      const entity = await prisma.entity.create({
        data: {
          id: randomUUID(),
          campaignId,
          type: "location",
          category: "LOCATION",
          name: `Riverwood ${randomUUID()}`,
        },
      });
      return entity.id;
    }

    it("round-trips the entity link", async () => {
      const campaignId = await createCampaign();
      const entityId = await createEntity(campaignId);
      const marker = Marker.create({
        campaignId,
        name: "Old Mill",
        lat: 1,
        lng: 2,
        entityId,
      });

      await repository.create(marker);
      const found = await repository.findById(marker.Id);

      expect(found?.EntityId).toBe(entityId);
    });

    it("clears the link but keeps the marker when the entity is deleted", async () => {
      const campaignId = await createCampaign();
      const entityId = await createEntity(campaignId);
      const marker = Marker.create({
        campaignId,
        name: "Old Mill",
        lat: 1,
        lng: 2,
        entityId,
      });
      await repository.create(marker);

      await prisma.entity.delete({ where: { id: entityId } });

      // ON DELETE SET NULL, not CASCADE — the annotation outlives the entity
      // it pointed at. This is the whole reason the FK differs from the
      // campaign relation, and only a real database proves it.
      const found = await repository.findById(marker.Id);
      expect(found).not.toBeNull();
      expect(found?.EntityId).toBeNull();
    });
  });
});
