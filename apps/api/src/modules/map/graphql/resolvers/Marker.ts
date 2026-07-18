import type { Marker as DomainMarker } from "@storyforge/domain";

export const Marker = {
  id: (marker: DomainMarker) => marker.Id.toString(),
  campaignId: (marker: DomainMarker) => marker.CampaignId,
  name: (marker: DomainMarker) => marker.Name,
  lat: (marker: DomainMarker) => marker.Lat,
  lng: (marker: DomainMarker) => marker.Lng,
  description: (marker: DomainMarker) => marker.Description,
  createdAt: (marker: DomainMarker) => marker.CreatedAt.toISOString(),
  updatedAt: (marker: DomainMarker) => marker.UpdatedAt.toISOString(),
};
