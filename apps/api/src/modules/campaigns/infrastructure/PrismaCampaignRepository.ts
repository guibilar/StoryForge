import {
  Campaign,
  CampaignRepository,
  CampaignId,
  ValidationError,
} from "@storyforge/domain";

import { prisma, Prisma } from "@storyforge/database";
import { CampaignMapper } from "./CampaignMapper";

export class PrismaCampaignRepository implements CampaignRepository {
  async findById(id: CampaignId): Promise<Campaign | null> {
    const record = await prisma.campaign.findUnique({
      where: {
        id: id.toString(),
      },
      include: { members: true },
    });

    if (!record) {
      return null;
    }

    return CampaignMapper.toDomain(record);
  }

  async existsByName(name: string): Promise<boolean> {
    const count = await prisma.campaign.count({
      where: {
        name,
      },
    });

    return count > 0;
  }

  async listCampaigns(userId: string): Promise<Campaign[]> {
    const records = await prisma.campaign.findMany({
      where: {
        members: {
          some: { userId },
        },
      },
      include: { members: true },
    });

    return records.map(CampaignMapper.toDomain);
  }

  async create(entity: Campaign): Promise<Campaign> {
    try {
      const record = await prisma.campaign.create({
        data: CampaignMapper.toPersistence(entity),
        include: { members: true },
      });
      return CampaignMapper.toDomain(record);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ValidationError(
          `A campaign with the name "${entity.Name}" already exists.`,
        );
      }
      throw error;
    }
  }

  async update(entity: Campaign): Promise<Campaign> {
    const record = await prisma.campaign.update({
      where: {
        id: entity.Id.toString(),
      },
      data: CampaignMapper.toPersistence(entity),
      include: { members: true },
    });
    return CampaignMapper.toDomain(record);
  }

  async archive(campaign: Campaign): Promise<void> {
    await prisma.campaign.update({
      where: {
        id: campaign.Id.toString(),
      },
      data: {
        archivedAt: new Date(),
      },
    });
  }
}
