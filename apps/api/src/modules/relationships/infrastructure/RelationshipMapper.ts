import { Relationship, RelationshipId } from "@storyforge/domain";
import type { Relationship as PrismaRelationship } from "@storyforge/database";

export class RelationshipMapper {
  static toDomain(record: PrismaRelationship): Relationship {
    return Relationship.rehydrate({
      id: RelationshipId.fromString(record.id),
      campaignId: record.campaignId,
      sourceEntityId: record.sourceEntityId,
      targetEntityId: record.targetEntityId,
      type: record.type,
      description: record.description,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      deletedAt: record.deletedAt,
    });
  }

  static toPersistence(relationship: Relationship) {
    return {
      id: relationship.Id.toString(),
      campaignId: relationship.CampaignId,
      sourceEntityId: relationship.SourceEntityId,
      targetEntityId: relationship.TargetEntityId,
      type: relationship.Type,
      description: relationship.Description,
      createdAt: relationship.CreatedAt,
      updatedAt: relationship.UpdatedAt,
      deletedAt: relationship.DeletedAt,
    };
  }
}
