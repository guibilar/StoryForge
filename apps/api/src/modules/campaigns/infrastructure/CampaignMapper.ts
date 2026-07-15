import { Campaign, CampaignId } from "@storyforge/domain";
import type { Prisma } from "@storyforge/database";
import { CampaignMemberMapper } from "../../campaignMembers/infrastructure/CampaignMemberMapper";

export type PrismaCampaignWithMembers = Prisma.CampaignGetPayload<{
  include: { members: true };
}>;

export class CampaignMapper {
  static toDomain(record: PrismaCampaignWithMembers): Campaign {
    return Campaign.rehydrate({
      id: CampaignId.fromString(record.id),
      name: record.name,
      description: record.description,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      archivedAt: record.archivedAt,
      campaignMembers: record.members.map(CampaignMemberMapper.toDomain),
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
