import { Marker, MarkerId } from "@storyforge/domain";
import type { Marker as PrismaMarker } from "@storyforge/database";

export class MarkerMapper {
  static toDomain(record: PrismaMarker): Marker {
    return Marker.rehydrate({
      id: MarkerId.fromString(record.id),
      campaignId: record.campaignId,
      name: record.name,
      lat: record.lat,
      lng: record.lng,
      description: record.description,
      entityId: record.entityId,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }

  static toPersistence(marker: Marker) {
    return {
      id: marker.Id.toString(),
      campaignId: marker.CampaignId,
      name: marker.Name,
      lat: marker.Lat,
      lng: marker.Lng,
      description: marker.Description,
      entityId: marker.EntityId,
      createdAt: marker.CreatedAt,
      updatedAt: marker.UpdatedAt,
    };
  }
}
