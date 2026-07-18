import type { Marker as DomainMarker } from "@storyforge/domain";
import type { GraphQLContext } from "../../../../graphql/context";

export const Marker = {
  id: (marker: DomainMarker) => marker.Id.toString(),
  campaignId: (marker: DomainMarker) => marker.CampaignId,
  entityId: (marker: DomainMarker) => marker.EntityId,
  entity: (marker: DomainMarker, _args: unknown, context: GraphQLContext) =>
    marker.EntityId ? context.entityService.findEntity(marker.EntityId) : null,
  name: (marker: DomainMarker) => marker.Name,
  lat: (marker: DomainMarker) => marker.Lat,
  lng: (marker: DomainMarker) => marker.Lng,
  description: (marker: DomainMarker) => marker.Description,
  createdAt: (marker: DomainMarker) => marker.CreatedAt.toISOString(),
  updatedAt: (marker: DomainMarker) => marker.UpdatedAt.toISOString(),
};
