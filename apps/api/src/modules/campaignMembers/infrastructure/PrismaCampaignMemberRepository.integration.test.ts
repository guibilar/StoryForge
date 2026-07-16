import { afterEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { CampaignMember, UserId } from "@storyforge/domain";
import { prisma } from "@storyforge/database";
import { PrismaCampaignMemberRepository } from "./PrismaCampaignMemberRepository";

const repository = new PrismaCampaignMemberRepository();
const createdCampaignIds: string[] = [];
const createdUserIds: string[] = [];

async function createCampaign(): Promise<string> {
  const campaign = await prisma.campaign.create({
    data: { id: randomUUID(), name: `test-campaign-${randomUUID()}` },
  });
  createdCampaignIds.push(campaign.id);
  return campaign.id;
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
  if (createdCampaignIds.length > 0) {
    await prisma.campaign.deleteMany({
      where: { id: { in: createdCampaignIds } },
    });
    createdCampaignIds.length = 0;
  }
  if (createdUserIds.length > 0) {
    await prisma.user.deleteMany({
      where: { id: { in: createdUserIds } },
    });
    createdUserIds.length = 0;
  }
});

describe("PrismaCampaignMemberRepository", () => {
  it("creates a member and finds it by campaign and user", async () => {
    const campaignId = await createCampaign();
    const userId = await createUser();
    const member = CampaignMember.create({
      campaignId,
      userId: UserId.fromString(userId),
      role: "OWNER",
    });

    await repository.create(member);
    const found = await repository.findByCampaignAndUser(
      campaignId,
      UserId.fromString(userId),
    );

    expect(found).not.toBeNull();
    expect(found?.CampaignId).toBe(campaignId);
    expect(found?.UserId.toString()).toBe(userId);
    expect(found?.Role).toBe("OWNER");
  });

  it("returns null when no membership exists", async () => {
    const campaignId = await createCampaign();

    const found = await repository.findByCampaignAndUser(
      campaignId,
      UserId.create(),
    );

    expect(found).toBeNull();
  });

  it("lists members for a campaign", async () => {
    const campaignId = await createCampaign();
    const ownerId = await createUser();
    const playerId = await createUser();
    await repository.create(
      CampaignMember.create({
        campaignId,
        userId: UserId.fromString(ownerId),
        role: "OWNER",
      }),
    );
    await repository.create(
      CampaignMember.create({
        campaignId,
        userId: UserId.fromString(playerId),
        role: "PLAYER",
      }),
    );

    const members = await repository.listByCampaign(campaignId);

    expect(members.map((m) => m.UserId.toString()).sort()).toEqual(
      [ownerId, playerId].sort(),
    );
  });

  it("updates a member's role", async () => {
    const campaignId = await createCampaign();
    const userId = await createUser();
    const member = CampaignMember.create({
      campaignId,
      userId: UserId.fromString(userId),
      role: "PLAYER",
    });
    await repository.create(member);

    member.changeRole("STORYTELLER");
    await repository.update(member);

    const found = await repository.findByCampaignAndUser(
      campaignId,
      UserId.fromString(userId),
    );
    expect(found?.Role).toBe("STORYTELLER");
  });

  it("deletes a member", async () => {
    const campaignId = await createCampaign();
    const userId = await createUser();
    const member = CampaignMember.create({
      campaignId,
      userId: UserId.fromString(userId),
      role: "PLAYER",
    });
    await repository.create(member);

    await repository.delete(campaignId, UserId.fromString(userId));

    const found = await repository.findByCampaignAndUser(
      campaignId,
      UserId.fromString(userId),
    );
    expect(found).toBeNull();
  });
});
