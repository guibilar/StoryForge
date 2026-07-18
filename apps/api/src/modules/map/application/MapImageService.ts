import {
  MapImage,
  MapImageRepository,
  NotFoundError,
} from "@storyforge/domain";

export interface MapImageFileStore {
  delete(url: string): Promise<void>;
}

export interface UploadMapImageDto {
  campaignId: string;
  url: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  width: number;
  height: number;
}

export class MapImageService {
  constructor(
    private readonly repository: MapImageRepository,
    private readonly fileStore: MapImageFileStore,
  ) {}

  // Re-uploading replaces the existing image in place (same id) rather than
  // creating a second row — there's only ever one map image per campaign
  // (@@unique([campaignId])). The previous file is deleted from disk after
  // the new row is persisted, so a failed upsert never orphans the old one.
  async uploadMapImage(dto: UploadMapImageDto): Promise<MapImage> {
    const existing = await this.repository.findByCampaign(dto.campaignId);
    const previousUrl = existing?.Url ?? null;
    const mapImage = existing ?? MapImage.create(dto);

    if (existing) {
      existing.replaceImage(dto);
    }

    await this.repository.upsert(mapImage);

    if (previousUrl && previousUrl !== mapImage.Url) {
      await this.fileStore.delete(previousUrl);
    }

    return mapImage;
  }

  async getMapImage(campaignId: string): Promise<MapImage | null> {
    return this.repository.findByCampaign(campaignId);
  }

  async deleteMapImage(campaignId: string): Promise<void> {
    const existing = await this.repository.findByCampaign(campaignId);

    if (!existing) {
      throw new NotFoundError("Map image not found.");
    }

    await this.repository.deleteByCampaign(campaignId);
    await this.fileStore.delete(existing.Url);
  }
}
