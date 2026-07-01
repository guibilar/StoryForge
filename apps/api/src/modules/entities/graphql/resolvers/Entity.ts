import type { Entity as DomainEntity } from "@storyforge/domain";

export const Entity = {
    id: (entity: DomainEntity) => entity.Id.toString(),
    campaignId: (entity: DomainEntity) => entity.CampaignId,
    type: (entity: DomainEntity) => entity.Type,
    name: (entity: DomainEntity) => entity.Name,
    description: (entity: DomainEntity) => entity.Description,
    icon: (entity: DomainEntity) => entity.Icon,
    visibility: (entity: DomainEntity) => entity.Visibility,
    createdAt: (entity: DomainEntity) => entity.CreatedAt.toISOString(),
    updatedAt: (entity: DomainEntity) => entity.UpdatedAt.toISOString(),
    deletedAt: (entity: DomainEntity) => entity.DeletedAt?.toISOString() ?? null,
};