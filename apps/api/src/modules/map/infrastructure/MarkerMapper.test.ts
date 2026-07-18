import { describe, expect, it } from "vitest";
import { Marker } from "@storyforge/domain";
import type { Marker as PrismaMarker } from "@storyforge/database";
import { MarkerMapper } from "./MarkerMapper";

describe("MarkerMapper", () => {
  it("maps a persistence record to a domain marker", () => {
    const record: PrismaMarker = {
      id: "11111111-1111-1111-1111-111111111111",
      campaignId: "22222222-2222-2222-2222-222222222222",
      name: "Old Mill",
      lat: 51.505,
      lng: -0.09,
      description: "Abandoned mill on the river.",
      createdAt: new Date("2024-01-01T00:00:00Z"),
      updatedAt: new Date("2024-02-01T00:00:00Z"),
    };

    const marker = MarkerMapper.toDomain(record);

    expect(marker.Id.toString()).toBe(record.id);
    expect(marker.CampaignId).toBe(record.campaignId);
    expect(marker.Name).toBe(record.name);
    expect(marker.Lat).toBe(record.lat);
    expect(marker.Lng).toBe(record.lng);
    expect(marker.Description).toBe(record.description);
    expect(marker.CreatedAt).toEqual(record.createdAt);
    expect(marker.UpdatedAt).toEqual(record.updatedAt);
  });

  it("maps a domain marker to a persistence shape", () => {
    const marker = Marker.create({
      campaignId: "22222222-2222-2222-2222-222222222222",
      name: "Old Mill",
      lat: 51.505,
      lng: -0.09,
      description: "Abandoned mill on the river.",
    });

    const record = MarkerMapper.toPersistence(marker);

    expect(record).toEqual({
      id: marker.Id.toString(),
      campaignId: marker.CampaignId,
      name: marker.Name,
      lat: marker.Lat,
      lng: marker.Lng,
      description: marker.Description,
      entityId: null,
      createdAt: marker.CreatedAt,
      updatedAt: marker.UpdatedAt,
    });
  });
});
