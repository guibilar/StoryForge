import type { Relationship as DomainRelationship } from "@storyforge/domain";

export const Relationship = {
  id: (relationship: DomainRelationship) => relationship.Id.toString(),
  campaignId: (relationship: DomainRelationship) => relationship.CampaignId,
  sourceEntityId: (relationship: DomainRelationship) =>
    relationship.SourceEntityId,
  targetEntityId: (relationship: DomainRelationship) =>
    relationship.TargetEntityId,
  type: (relationship: DomainRelationship) => relationship.Type,
  description: (relationship: DomainRelationship) => relationship.Description,
  createdAt: (relationship: DomainRelationship) =>
    relationship.CreatedAt.toISOString(),
  updatedAt: (relationship: DomainRelationship) =>
    relationship.UpdatedAt.toISOString(),
  deletedAt: (relationship: DomainRelationship) =>
    relationship.DeletedAt?.toISOString() ?? null,
};
