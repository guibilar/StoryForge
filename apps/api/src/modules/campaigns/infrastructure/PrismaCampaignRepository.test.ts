import { afterEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { Campaign, CampaignId } from "@storyforge/domain";
import { prisma } from "@storyforge/database";
import { PrismaCampaignRepository } from "./PrismaCampaignRepository";

const repository = new PrismaCampaignRepository();
const createdIds: string[] = [];

function uniqueName(): string {
  return `test-campaign-${randomUUID()}`;
}

afterEach(async () => {
  if (createdIds.length > 0) {
    await prisma.campaign.deleteMany({ where: { id: { in: createdIds } } });
    createdIds.length = 0;
  }
});

describe("PrismaCampaignRepository", () => {
  it("creates a campaign and finds it by id", async () => {
    const campaign = Campaign.create({
      name: uniqueName(),
      description: "desc",
    });
    createdIds.push(campaign.Id.toString());

    const created = await repository.create(campaign);
    const found = await repository.findById(created.Id);

    expect(found).not.toBeNull();
    expect(found?.Id.equals(created.Id)).toBe(true);
    expect(found?.Name).toBe(campaign.Name);
    expect(found?.Description).toBe("desc");
  });

  it("returns null when the campaign does not exist", async () => {
    const found = await repository.findById(CampaignId.create());

    expect(found).toBeNull();
  });

  it("reports whether a name already exists", async () => {
    const name = uniqueName();
    const campaign = Campaign.create({ name });
    createdIds.push(campaign.Id.toString());
    await repository.create(campaign);

    await expect(repository.existsByName(name)).resolves.toBe(true);
    await expect(repository.existsByName(uniqueName())).resolves.toBe(false);
  });

  it("updates a campaign's name and description", async () => {
    const campaign = Campaign.create({
      name: uniqueName(),
      description: "old",
    });
    createdIds.push(campaign.Id.toString());
    const created = await repository.create(campaign);

    created.rename(uniqueName());
    created.changeDescription("new");
    const updated = await repository.update(created);

    expect(updated.Description).toBe("new");
    const found = await repository.findById(created.Id);
    expect(found?.Name).toBe(created.Name);
  });

  it("archives a campaign", async () => {
    const campaign = Campaign.create({ name: uniqueName() });
    createdIds.push(campaign.Id.toString());
    const created = await repository.create(campaign);

    await repository.archive(created);

    const found = await repository.findById(created.Id);
    expect(found?.ArchivedAt).toBeInstanceOf(Date);
  });

  it("lists campaigns including the ones just created", async () => {
    const campaign = Campaign.create({ name: uniqueName() });
    createdIds.push(campaign.Id.toString());
    await repository.create(campaign);

    const campaigns = await repository.listCampaigns();

    expect(campaigns.some((c) => c.Id.equals(campaign.Id))).toBe(true);
  });
});
