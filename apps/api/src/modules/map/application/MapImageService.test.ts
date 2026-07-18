import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  MapImage,
  MapImageRepository,
  NotFoundError,
} from "@storyforge/domain";
import { MapImageService, MapImageFileStore } from "./MapImageService";

function makeRepository(): MapImageRepository {
  return {
    findByCampaign: vi.fn(),
    upsert: vi.fn(),
    deleteByCampaign: vi.fn(),
  };
}

function makeFileStore(): MapImageFileStore {
  return { delete: vi.fn() };
}

const uploadDto = {
  campaignId: "campaign-1",
  url: "/uploads/campaign-1/first.png",
  fileName: "fantasy-map.png",
  mimeType: "image/png",
  sizeBytes: 1000,
  width: 2000,
  height: 1500,
};

describe("MapImageService", () => {
  let repository: MapImageRepository;
  let fileStore: MapImageFileStore;
  let service: MapImageService;

  beforeEach(() => {
    repository = makeRepository();
    fileStore = makeFileStore();
    service = new MapImageService(repository, fileStore);
  });

  describe("uploadMapImage", () => {
    it("creates a new map image when the campaign has none yet", async () => {
      vi.mocked(repository.findByCampaign).mockResolvedValue(null);

      const mapImage = await service.uploadMapImage(uploadDto);

      expect(mapImage.Url).toBe(uploadDto.url);
      expect(repository.upsert).toHaveBeenCalledWith(mapImage);
      expect(fileStore.delete).not.toHaveBeenCalled();
    });

    it("replaces an existing map image in place and deletes the old file", async () => {
      const existing = MapImage.create(uploadDto);
      vi.mocked(repository.findByCampaign).mockResolvedValue(existing);
      const replacementDto = {
        ...uploadDto,
        url: "/uploads/campaign-1/second.png",
        fileName: "new-map.png",
        width: 800,
        height: 600,
      };

      const mapImage = await service.uploadMapImage(replacementDto);

      expect(mapImage.Id.equals(existing.Id)).toBe(true);
      expect(mapImage.Url).toBe(replacementDto.url);
      expect(mapImage.Width).toBe(800);
      expect(repository.upsert).toHaveBeenCalledWith(existing);
      expect(fileStore.delete).toHaveBeenCalledWith(uploadDto.url);
    });
  });

  describe("getMapImage", () => {
    it("returns null when the campaign has no map image", async () => {
      vi.mocked(repository.findByCampaign).mockResolvedValue(null);

      await expect(service.getMapImage("campaign-1")).resolves.toBeNull();
    });

    it("returns the map image when found", async () => {
      const mapImage = MapImage.create(uploadDto);
      vi.mocked(repository.findByCampaign).mockResolvedValue(mapImage);

      await expect(service.getMapImage("campaign-1")).resolves.toBe(mapImage);
    });
  });

  describe("deleteMapImage", () => {
    it("throws NotFoundError when the campaign has no map image", async () => {
      vi.mocked(repository.findByCampaign).mockResolvedValue(null);

      await expect(service.deleteMapImage("campaign-1")).rejects.toThrow(
        NotFoundError,
      );
      expect(repository.deleteByCampaign).not.toHaveBeenCalled();
    });

    it("deletes the row and the underlying file", async () => {
      const mapImage = MapImage.create(uploadDto);
      vi.mocked(repository.findByCampaign).mockResolvedValue(mapImage);

      await service.deleteMapImage("campaign-1");

      expect(repository.deleteByCampaign).toHaveBeenCalledWith("campaign-1");
      expect(fileStore.delete).toHaveBeenCalledWith(uploadDto.url);
    });
  });
});
