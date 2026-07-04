import { Campaign, CampaignId } from "@storyforge/domain";
import type { Campaign as PrismaCampaign } from "@storyforge/database";

export class CampaignMapper {
  static toDomain(record: PrismaCampaign): Campaign {
    return Campaign.rehydrate({
      id: CampaignId.fromString(record.id),
      name: record.name,
      description: record.description,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      archivedAt: record.archivedAt,
      campaignMembers: [], // Assuming you will fetch members separately
      entities: [], // Assuming you will fetch entities separately
    });
  }

  static toPersistence(entity: Campaign) {
    return {
      id: entity.Id.toString(),
      name: entity.Name,
      description: entity.Description,
    };
  }
}
