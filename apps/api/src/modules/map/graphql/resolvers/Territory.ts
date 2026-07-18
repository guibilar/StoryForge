import type { Territory as DomainTerritory } from "@storyforge/domain";

export const Territory = {
  id: (territory: DomainTerritory) => territory.Id.toString(),
  campaignId: (territory: DomainTerritory) => territory.CampaignId,
  name: (territory: DomainTerritory) => territory.Name,
  type: (territory: DomainTerritory) => territory.Type,
  geometry: (territory: DomainTerritory) => JSON.stringify(territory.Geometry),
  description: (territory: DomainTerritory) => territory.Description,
  createdAt: (territory: DomainTerritory) => territory.CreatedAt.toISOString(),
  updatedAt: (territory: DomainTerritory) => territory.UpdatedAt.toISOString(),
};
