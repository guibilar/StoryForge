import {
  Relationship,
  RelationshipId,
  RelationshipVisibility,
  UserId,
} from "@storyforge/domain";
import type {
  Relationship as PrismaRelationship,
  RelationshipRecipient as PrismaRelationshipRecipient,
} from "@storyforge/database";

export type RelationshipRecord = PrismaRelationship & {
  recipients: PrismaRelationshipRecipient[];
};

export class RelationshipMapper {
  static toDomain(record: RelationshipRecord): Relationship {
    return Relationship.rehydrate({
      id: RelationshipId.fromString(record.id),
      campaignId: record.campaignId,
      sourceEntityId: record.sourceEntityId,
      targetEntityId: record.targetEntityId,
      type: record.type,
      description: record.description,
      visibility: record.visibility as RelationshipVisibility,
      recipientIds: record.recipients.map((recipient) =>
        UserId.fromString(recipient.userId),
      ),
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
      visibility: relationship.Visibility,
      createdAt: relationship.CreatedAt,
      updatedAt: relationship.UpdatedAt,
      deletedAt: relationship.DeletedAt,
    };
  }

  static toRecipientCreates(relationship: Relationship) {
    return relationship.RecipientIds.map((userId) => ({
      userId: userId.toString(),
    }));
  }
}
