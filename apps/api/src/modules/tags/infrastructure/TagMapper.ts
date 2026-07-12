import { Tag, TagId } from "@storyforge/domain";
import type { Tag as PrismaTag } from "@storyforge/database";

export class TagMapper {
  static toDomain(record: PrismaTag): Tag {
    return Tag.rehydrate({
      id: TagId.fromString(record.id),
      campaignId: record.campaignId,
      name: record.name,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }

  static toPersistence(entity: Tag) {
    return {
      id: entity.Id.toString(),
      campaignId: entity.CampaignId,
      name: entity.Name,
      createdAt: entity.CreatedAt,
      updatedAt: entity.UpdatedAt,
    };
  }
}
