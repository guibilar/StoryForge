import {
  Territory,
  TerritoryId,
  TerritoryRepository,
} from "@storyforge/domain";

import { prisma } from "@storyforge/database";
import { TerritoryMapper } from "./TerritoryMapper";

export class PrismaTerritoryRepository implements TerritoryRepository {
  async findById(id: TerritoryId): Promise<Territory | null> {
    const record = await prisma.territory.findUnique({
      where: { id: id.toString() },
    });

    if (!record) {
      return null;
    }

    return TerritoryMapper.toDomain(record);
  }

  async findByCampaign(campaignId: string): Promise<Territory[]> {
    const records = await prisma.territory.findMany({
      where: { campaignId },
      orderBy: { createdAt: "asc" },
    });

    return records.map(TerritoryMapper.toDomain);
  }

  async create(territory: Territory): Promise<void> {
    await prisma.territory.create({
      data: TerritoryMapper.toPersistence(territory),
    });
  }

  async update(territory: Territory): Promise<void> {
    await prisma.territory.update({
      where: { id: territory.Id.toString() },
      data: TerritoryMapper.toPersistence(territory),
    });
  }

  async delete(id: TerritoryId): Promise<void> {
    await prisma.territory.delete({ where: { id: id.toString() } });
  }
}
