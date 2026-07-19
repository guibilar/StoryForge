import {
  Entity,
  EntityCategory,
  EntityId,
  EntityVisibility,
} from "@storyforge/domain";
import type { Entity as PrismaEntity } from "@storyforge/database";

export class EntityMapper {
  static toDomain(record: PrismaEntity): Entity {
    return Entity.rehydrate({
      id: EntityId.fromString(record.id),
      campaignId: record.campaignId,
      type: record.type,
      category: record.category as EntityCategory,
      name: record.name,
      description: record.description,
      icon: record.icon,
      image: record.image,
      visibility: record.visibility as EntityVisibility,
      isPlayerCharacter: record.isPlayerCharacter,
      ownerUserId: record.ownerUserId,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      deletedAt: record.deletedAt,
    });
  }

  static toPersistence(entity: Entity) {
    return {
      id: entity.Id.toString(),
      campaignId: entity.CampaignId,
      type: entity.Type,
      category: entity.Category,
      name: entity.Name,
      description: entity.Description,
      icon: entity.Icon,
      image: entity.Image,
      visibility: entity.Visibility,
      isPlayerCharacter: entity.IsPlayerCharacter,
      ownerUserId: entity.OwnerUserId,
      createdAt: entity.CreatedAt,
      updatedAt: entity.UpdatedAt,
      deletedAt: entity.DeletedAt,
    };
  }
}
