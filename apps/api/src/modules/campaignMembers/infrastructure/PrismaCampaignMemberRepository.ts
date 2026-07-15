import {
  CampaignMember,
  CampaignMemberRepository,
  UserId,
} from "@storyforge/domain";

import { prisma } from "@storyforge/database";
import { CampaignMemberMapper } from "./CampaignMemberMapper";

export class PrismaCampaignMemberRepository implements CampaignMemberRepository {
  async listByCampaign(campaignId: string): Promise<CampaignMember[]> {
    const records = await prisma.campaignMember.findMany({
      where: { campaignId },
      orderBy: { createdAt: "asc" },
    });

    return records.map(CampaignMemberMapper.toDomain);
  }

  async findByCampaignAndUser(
    campaignId: string,
    userId: UserId,
  ): Promise<CampaignMember | null> {
    const record = await prisma.campaignMember.findUnique({
      where: {
        campaignId_userId: {
          campaignId,
          userId: userId.toString(),
        },
      },
    });

    if (!record) {
      return null;
    }

    return CampaignMemberMapper.toDomain(record);
  }

  async create(member: CampaignMember): Promise<void> {
    await prisma.campaignMember.create({
      data: CampaignMemberMapper.toPersistence(member),
    });
  }

  async update(member: CampaignMember): Promise<void> {
    await prisma.campaignMember.update({
      where: {
        campaignId_userId: {
          campaignId: member.CampaignId,
          userId: member.UserId.toString(),
        },
      },
      data: CampaignMemberMapper.toPersistence(member),
    });
  }

  async delete(campaignId: string, userId: UserId): Promise<void> {
    await prisma.campaignMember.delete({
      where: {
        campaignId_userId: {
          campaignId,
          userId: userId.toString(),
        },
      },
    });
  }
}
