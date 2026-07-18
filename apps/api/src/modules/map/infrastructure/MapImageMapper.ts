import { MapImage, MapImageId } from "@storyforge/domain";
import type { MapImage as PrismaMapImage } from "@storyforge/database";

export class MapImageMapper {
  static toDomain(record: PrismaMapImage): MapImage {
    return MapImage.rehydrate({
      id: MapImageId.fromString(record.id),
      campaignId: record.campaignId,
      url: record.url,
      fileName: record.fileName,
      mimeType: record.mimeType,
      sizeBytes: record.sizeBytes,
      width: record.width,
      height: record.height,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }

  static toPersistence(mapImage: MapImage) {
    return {
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
    };
  }
}
