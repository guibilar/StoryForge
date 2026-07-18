import type { MapImage as DomainMapImage } from "@storyforge/domain";

export const MapImage = {
  id: (mapImage: DomainMapImage) => mapImage.Id.toString(),
  campaignId: (mapImage: DomainMapImage) => mapImage.CampaignId,
  url: (mapImage: DomainMapImage) => mapImage.Url,
  fileName: (mapImage: DomainMapImage) => mapImage.FileName,
  mimeType: (mapImage: DomainMapImage) => mapImage.MimeType,
  sizeBytes: (mapImage: DomainMapImage) => mapImage.SizeBytes,
  width: (mapImage: DomainMapImage) => mapImage.Width,
  height: (mapImage: DomainMapImage) => mapImage.Height,
  createdAt: (mapImage: DomainMapImage) => mapImage.CreatedAt.toISOString(),
  updatedAt: (mapImage: DomainMapImage) => mapImage.UpdatedAt.toISOString(),
};
