import type { Entity as DomainEntity } from "@storyforge/domain";
import { GraphQLContext } from "../../../../graphql/context";

export const Entity = {
  id: (entity: DomainEntity) => entity.Id.toString(),
  campaignId: (entity: DomainEntity) => entity.CampaignId,
  type: (entity: DomainEntity) => entity.Type,
  category: (entity: DomainEntity) => entity.Category,
  name: (entity: DomainEntity) => entity.Name,
  description: (entity: DomainEntity) => entity.Description,
  icon: (entity: DomainEntity) => entity.Icon,
  image: (entity: DomainEntity) => entity.Image,
  color: (entity: DomainEntity) => entity.Color,
  visibility: (entity: DomainEntity) => entity.Visibility,
  isPlayerCharacter: (entity: DomainEntity) => entity.IsPlayerCharacter,
  ownerUserId: (entity: DomainEntity) => entity.OwnerUserId,
  ownerMember: (
    entity: DomainEntity,
    _args: unknown,
    context: GraphQLContext,
  ) =>
    entity.OwnerUserId
      ? context.campaignMemberService.getMembership(
          entity.CampaignId,
          entity.OwnerUserId,
        )
      : null,
  createdAt: (entity: DomainEntity) => entity.CreatedAt.toISOString(),
  updatedAt: (entity: DomainEntity) => entity.UpdatedAt.toISOString(),
  deletedAt: (entity: DomainEntity) => entity.DeletedAt?.toISOString() ?? null,
  tags: (entity: DomainEntity, _args: unknown, context: GraphQLContext) =>
    context.tagService.listEntityTags(entity.Id.toString()),
};
