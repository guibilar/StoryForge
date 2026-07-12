import type { Tag as DomainEntity } from "@storyforge/domain";

export const Tag = {
  id: (entity: DomainEntity) => entity.Id.toString(),
  campaignId: (entity: DomainEntity) => entity.CampaignId,
  name: (entity: DomainEntity) => entity.Name,
  createdAt: (entity: DomainEntity) => entity.CreatedAt.toISOString(),
  updatedAt: (entity: DomainEntity) => entity.UpdatedAt.toISOString(),
};
