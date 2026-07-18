import { describe, expect, it } from "vitest";
import { MapImage } from "@storyforge/domain";
import type { MapImage as PrismaMapImage } from "@storyforge/database";
import { MapImageMapper } from "./MapImageMapper";

describe("MapImageMapper", () => {
  it("maps a persistence record to a domain map image", () => {
    const record: PrismaMapImage = {
      id: "11111111-1111-1111-1111-111111111111",
      campaignId: "22222222-2222-2222-2222-222222222222",
      url: "/uploads/22222222-2222-2222-2222-222222222222/abc.png",
      fileName: "fantasy-map.png",
      mimeType: "image/png",
      sizeBytes: 12345,
      width: 2000,
      height: 1500,
      createdAt: new Date("2024-01-01T00:00:00Z"),
      updatedAt: new Date("2024-02-01T00:00:00Z"),
    };

    const mapImage = MapImageMapper.toDomain(record);

    expect(mapImage.Id.toString()).toBe(record.id);
    expect(mapImage.CampaignId).toBe(record.campaignId);
    expect(mapImage.Url).toBe(record.url);
    expect(mapImage.FileName).toBe(record.fileName);
    expect(mapImage.MimeType).toBe(record.mimeType);
    expect(mapImage.SizeBytes).toBe(record.sizeBytes);
    expect(mapImage.Width).toBe(record.width);
    expect(mapImage.Height).toBe(record.height);
    expect(mapImage.CreatedAt).toEqual(record.createdAt);
    expect(mapImage.UpdatedAt).toEqual(record.updatedAt);
  });

  it("maps a domain map image to a persistence shape", () => {
    const mapImage = MapImage.create({
      campaignId: "22222222-2222-2222-2222-222222222222",
      url: "/uploads/22222222-2222-2222-2222-222222222222/abc.png",
      fileName: "fantasy-map.png",
      mimeType: "image/png",
      sizeBytes: 12345,
      width: 2000,
      height: 1500,
    });

    const record = MapImageMapper.toPersistence(mapImage);

    expect(record).toEqual({
      id: mapImage.Id.toString(),
      campaignId: mapImage.CampaignId,
      url: mapImage.Url,
      fileName: mapImage.FileName,
      mimeType: mapImage.MimeType,
      sizeBytes: mapImage.SizeBytes,
      width: mapImage.Width,
      height: mapImage.Height,
      createdAt: mapImage.CreatedAt,
      updatedAt: mapImage.UpdatedAt,
    });
  });
});
