import { Entity, EntityId } from "@storyforge/domain";
import type { Entity as PrismaEntity } from "@storyforge/database";

export class EntityMapper {
    static toDomain(record: PrismaEntity): Entity {
        return Entity.rehydrate({
            id: EntityId.fromString(record.id),
            campaignId: record.campaignId,
            type: record.type,
            name: record.name,
            description: record.description,
            icon: record.icon,
            visibility: record.visibility,
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
            name: entity.Name,
            description: entity.Description,
            icon: entity.Icon,
            visibility: entity.Visibility,
            createdAt: entity.CreatedAt,
            updatedAt: entity.UpdatedAt,
            deletedAt: entity.DeletedAt,
        };
    }
}