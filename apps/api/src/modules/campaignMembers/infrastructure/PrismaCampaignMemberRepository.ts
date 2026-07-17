import {
  CampaignMember,
  CampaignMemberRepository,
  CampaignRole,
  UserId,
  ValidationError,
} from "@storyforge/domain";

import { prisma, Prisma } from "@storyforge/database";
import { CampaignMemberMapper } from "./CampaignMemberMapper";

const OWNER_CONFLICT_MESSAGE =
  "This campaign already has an owner. Only one owner is allowed per campaign.";
const DUPLICATE_MEMBER_MESSAGE =
  "This user is already a member of this campaign.";

function conflictMessageFor(error: unknown): string | null {
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) ||
    error.code !== "P2002"
  ) {
    return null;
  }

  const target = error.meta?.target;
  const targetsUserId =
    typeof target === "string"
      ? target.includes("userId")
      : Array.isArray(target) && target.includes("userId");

  return targetsUserId ? DUPLICATE_MEMBER_MESSAGE : OWNER_CONFLICT_MESSAGE;
}

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
    try {
      await prisma.campaignMember.create({
        data: CampaignMemberMapper.toPersistence(member),
      });
    } catch (error) {
      const message = conflictMessageFor(error);
      if (message) {
        throw new ValidationError(message);
      }
      throw error;
    }
  }

  async update(member: CampaignMember): Promise<void> {
    try {
      await prisma.campaignMember.update({
        where: {
          campaignId_userId: {
            campaignId: member.CampaignId,
            userId: member.UserId.toString(),
          },
        },
        data: CampaignMemberMapper.toPersistence(member),
      });
    } catch (error) {
      const message = conflictMessageFor(error);
      if (message) {
        throw new ValidationError(message);
      }
      throw error;
    }
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

  async transferOwnership(
    campaignId: string,
    currentOwnerUserId: UserId | null,
    newOwnerUserId: UserId,
    demotedRole: CampaignRole,
  ): Promise<void> {
    await prisma.$transaction(async (tx) => {
      if (currentOwnerUserId) {
        await tx.campaignMember.update({
          where: {
            campaignId_userId: {
              campaignId,
              userId: currentOwnerUserId.toString(),
            },
          },
          data: { role: demotedRole },
        });
      }

      await tx.campaignMember.update({
        where: {
          campaignId_userId: {
            campaignId,
            userId: newOwnerUserId.toString(),
          },
        },
        data: { role: "OWNER" },
      });
    });
  }
}
