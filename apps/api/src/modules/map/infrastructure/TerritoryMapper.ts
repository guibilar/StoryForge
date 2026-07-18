import { Territory, TerritoryGeometry, TerritoryId } from "@storyforge/domain";
import type {
  Territory as PrismaTerritory,
  Prisma,
} from "@storyforge/database";

export class TerritoryMapper {
  static toDomain(record: PrismaTerritory): Territory {
    return Territory.rehydrate({
      id: TerritoryId.fromString(record.id),
      campaignId: record.campaignId,
      name: record.name,
      type: record.type,
      geometry: record.geometry as TerritoryGeometry,
      description: record.description,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }

  static toPersistence(territory: Territory) {
    return {
      id: territory.Id.toString(),
      campaignId: territory.CampaignId,
      name: territory.Name,
      type: territory.Type,
      geometry: territory.Geometry as Prisma.InputJsonValue,
      description: territory.Description,
      createdAt: territory.CreatedAt,
      updatedAt: territory.UpdatedAt,
    };
  }
}
