import { afterEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { Campaign, CampaignId } from "@storyforge/domain";
import { prisma } from "@storyforge/database";
import { PrismaCampaignRepository } from "./PrismaCampaignRepository";

const repository = new PrismaCampaignRepository();
const createdIds: string[] = [];
const createdUserIds: string[] = [];

function uniqueName(): string {
  return `test-campaign-${randomUUID()}`;
}

async function createUser(): Promise<string> {
  const user = await prisma.user.create({
    data: {
      id: randomUUID(),
      email: `test-user-${randomUUID()}@example.com`,
      password: "hashed",
    },
  });
  createdUserIds.push(user.id);
  return user.id;
}

afterEach(async () => {
  if (createdIds.length > 0) {
    await prisma.campaign.deleteMany({ where: { id: { in: createdIds } } });
    createdIds.length = 0;
  }
  if (createdUserIds.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    createdUserIds.length = 0;
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

  it("hydrates campaign members on findById so the owner check can resolve", async () => {
    const ownerId = await createUser();

    const campaign = Campaign.create({ name: uniqueName() });
    createdIds.push(campaign.Id.toString());
    const created = await repository.create(campaign);
    await prisma.campaignMember.create({
      data: {
        id: randomUUID(),
        campaignId: created.Id.toString(),
        userId: ownerId,
        role: "OWNER",
      },
    });

    const found = await repository.findById(created.Id);

    expect(found?.Members).toHaveLength(1);
    expect(found?.Members[0].Role).toBe("OWNER");
    expect(found?.Members[0].UserId.toString()).toBe(ownerId);
    expect(found?.Members.some((m) => m.Role === "OWNER")).toBe(true);
  });

  it("archives a campaign", async () => {
    const campaign = Campaign.create({ name: uniqueName() });
    createdIds.push(campaign.Id.toString());
    const created = await repository.create(campaign);

    await repository.archive(created);

    const found = await repository.findById(created.Id);
    expect(found?.ArchivedAt).toBeInstanceOf(Date);
  });

  it("lists only campaigns the given user is a member of", async () => {
    const memberUserId = await createUser();
    const otherUserId = await createUser();

    const memberCampaign = Campaign.create({ name: uniqueName() });
    createdIds.push(memberCampaign.Id.toString());
    await repository.create(memberCampaign);
    await prisma.campaignMember.create({
      data: {
        id: randomUUID(),
        campaignId: memberCampaign.Id.toString(),
        userId: memberUserId,
        role: "OWNER",
      },
    });

    const otherCampaign = Campaign.create({ name: uniqueName() });
    createdIds.push(otherCampaign.Id.toString());
    await repository.create(otherCampaign);
    await prisma.campaignMember.create({
      data: {
        id: randomUUID(),
        campaignId: otherCampaign.Id.toString(),
        userId: otherUserId,
        role: "OWNER",
      },
    });

    const campaigns = await repository.listCampaigns(memberUserId);

    expect(campaigns.some((c) => c.Id.equals(memberCampaign.Id))).toBe(true);
    expect(campaigns.some((c) => c.Id.equals(otherCampaign.Id))).toBe(false);
  });

  it("excludes archived campaigns from the list", async () => {
    const memberUserId = await createUser();

    const campaign = Campaign.create({ name: uniqueName() });
    createdIds.push(campaign.Id.toString());
    await repository.create(campaign);
    await prisma.campaignMember.create({
      data: {
        id: randomUUID(),
        campaignId: campaign.Id.toString(),
        userId: memberUserId,
        role: "OWNER",
      },
    });

    await repository.archive(campaign);

    const campaigns = await repository.listCampaigns(memberUserId);

    expect(campaigns.some((c) => c.Id.equals(campaign.Id))).toBe(false);
  });
});
