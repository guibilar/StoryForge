import type { Territory as DomainTerritory } from "@storyforge/domain";
import type { GraphQLContext } from "../../../../graphql/context";

export const Territory = {
  id: (territory: DomainTerritory) => territory.Id.toString(),
  campaignId: (territory: DomainTerritory) => territory.CampaignId,
  entityId: (territory: DomainTerritory) => territory.EntityId,
  entity: (
    territory: DomainTerritory,
    _args: unknown,
    context: GraphQLContext,
  ) =>
    territory.EntityId
      ? context.entityService.findEntity(territory.EntityId)
      : null,
  name: (territory: DomainTerritory) => territory.Name,
  type: (territory: DomainTerritory) => territory.Type,
  geometry: (territory: DomainTerritory) => JSON.stringify(territory.Geometry),
  description: (territory: DomainTerritory) => territory.Description,
  createdAt: (territory: DomainTerritory) => territory.CreatedAt.toISOString(),
  updatedAt: (territory: DomainTerritory) => territory.UpdatedAt.toISOString(),
};
