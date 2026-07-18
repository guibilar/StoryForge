import { beforeEach, describe, expect, it, vi } from "vitest";
import { Marker, MarkerRepository, NotFoundError } from "@storyforge/domain";
import { MarkerService } from "./MarkerService";

function makeRepository(): MarkerRepository {
  return {
    findById: vi.fn(),
    findByCampaign: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
}

const createDto = {
  campaignId: "campaign-1",
  name: "Old Mill",
  lat: 51.505,
  lng: -0.09,
};

describe("MarkerService", () => {
  let repository: MarkerRepository;
  let service: MarkerService;

  beforeEach(() => {
    repository = makeRepository();
    service = new MarkerService(repository);
  });

  describe("createMarker", () => {
    it("creates and persists a marker", async () => {
      const marker = await service.createMarker(createDto);

      expect(marker.Name).toBe("Old Mill");
      expect(repository.create).toHaveBeenCalledWith(marker);
    });
  });

  describe("updateMarker", () => {
    it("throws NotFoundError when the marker does not exist", async () => {
      vi.mocked(repository.findById).mockResolvedValue(null);

      await expect(service.updateMarker({ id: "missing" })).rejects.toThrow(
        NotFoundError,
      );
    });

    it("renames, moves, and changes description", async () => {
      const marker = Marker.create(createDto);
      vi.mocked(repository.findById).mockResolvedValue(marker);

      const updated = await service.updateMarker({
        id: marker.Id.toString(),
        name: "New Mill",
        lat: 10,
        lng: 20,
        description: "Rebuilt.",
      });

      expect(updated.Name).toBe("New Mill");
      expect(updated.Lat).toBe(10);
      expect(updated.Lng).toBe(20);
      expect(updated.Description).toBe("Rebuilt.");
      expect(repository.update).toHaveBeenCalledWith(marker);
    });

    it("only moves lat when lng is omitted", async () => {
      const marker = Marker.create(createDto);
      vi.mocked(repository.findById).mockResolvedValue(marker);

      const updated = await service.updateMarker({
        id: marker.Id.toString(),
        lat: 10,
      });

      expect(updated.Lat).toBe(10);
      expect(updated.Lng).toBe(createDto.lng);
    });
  });

  describe("deleteMarker", () => {
    it("throws NotFoundError when the marker does not exist", async () => {
      vi.mocked(repository.findById).mockResolvedValue(null);

      await expect(service.deleteMarker("missing")).rejects.toThrow(
        NotFoundError,
      );
      expect(repository.delete).not.toHaveBeenCalled();
    });

    it("deletes the marker", async () => {
      const marker = Marker.create(createDto);
      vi.mocked(repository.findById).mockResolvedValue(marker);

      await service.deleteMarker(marker.Id.toString());

      expect(repository.delete).toHaveBeenCalledWith(marker.Id);
    });
  });

  describe("getMarker", () => {
    it("throws NotFoundError when the marker does not exist", async () => {
      vi.mocked(repository.findById).mockResolvedValue(null);

      await expect(service.getMarker("missing")).rejects.toThrow(NotFoundError);
    });

    it("returns the marker when found", async () => {
      const marker = Marker.create(createDto);
      vi.mocked(repository.findById).mockResolvedValue(marker);

      await expect(service.getMarker(marker.Id.toString())).resolves.toBe(
        marker,
      );
    });
  });

  describe("listMarkers", () => {
    it("delegates to the repository", async () => {
      const markers = [Marker.create(createDto)];
      vi.mocked(repository.findByCampaign).mockResolvedValue(markers);

      await expect(service.listMarkers("campaign-1")).resolves.toBe(markers);
      expect(repository.findByCampaign).toHaveBeenCalledWith("campaign-1");
    });
  });
});
