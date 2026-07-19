import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  Entity,
  EntityCategory,
  EntityRepository,
  Marker,
  MarkerRepository,
  NotFoundError,
  ValidationError,
} from "@storyforge/domain";
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

function makeEntityRepository(): EntityRepository {
  return {
    findById: vi.fn(),
    findByCampaign: vi.fn(),
    existsByName: vi.fn(),
    findByName: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
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
  let entityRepository: EntityRepository;
  let service: MarkerService;

  beforeEach(() => {
    repository = makeRepository();
    entityRepository = makeEntityRepository();
    service = new MarkerService(repository, entityRepository);
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

  describe("entity link", () => {
    function entityInCampaign(campaignId: string): Entity {
      return Entity.create({
        campaignId,
        type: "location",
        category: EntityCategory.LOCATION,
        name: "Old Mill",
      });
    }

    it("links a marker to an entity in the same campaign", async () => {
      vi.mocked(entityRepository.findById).mockResolvedValue(
        entityInCampaign("campaign-1"),
      );

      const marker = await service.createMarker({
        ...createDto,
        entityId: "entity-1",
      });

      expect(marker.EntityId).toBe("entity-1");
    });

    it("rejects an entity from a different campaign", async () => {
      vi.mocked(entityRepository.findById).mockResolvedValue(
        entityInCampaign("campaign-2"),
      );

      await expect(
        service.createMarker({ ...createDto, entityId: "entity-1" }),
      ).rejects.toThrow(ValidationError);
      expect(repository.create).not.toHaveBeenCalled();
    });

    it("rejects an entity that does not exist", async () => {
      vi.mocked(entityRepository.findById).mockResolvedValue(null);

      await expect(
        service.createMarker({ ...createDto, entityId: "entity-gone" }),
      ).rejects.toThrow(NotFoundError);
    });

    it("creates without touching the entity repository when unlinked", async () => {
      await service.createMarker(createDto);

      expect(entityRepository.findById).not.toHaveBeenCalled();
    });

    it("unlinks on an explicit null without looking the entity up", async () => {
      const existing = Marker.create({ ...createDto, entityId: "entity-1" });
      vi.mocked(repository.findById).mockResolvedValue(existing);

      const marker = await service.updateMarker({
        id: existing.Id.toString(),
        entityId: null,
      });

      expect(marker.EntityId).toBeNull();
      expect(entityRepository.findById).not.toHaveBeenCalled();
    });

    it("leaves the link untouched when entityId is omitted", async () => {
      const existing = Marker.create({ ...createDto, entityId: "entity-1" });
      vi.mocked(repository.findById).mockResolvedValue(existing);

      const marker = await service.updateMarker({
        id: existing.Id.toString(),
        name: "New Mill",
      });

      expect(marker.EntityId).toBe("entity-1");
    });

    it("validates a relinked entity against the marker's own campaign", async () => {
      const existing = Marker.create(createDto);
      vi.mocked(repository.findById).mockResolvedValue(existing);
      vi.mocked(entityRepository.findById).mockResolvedValue(
        entityInCampaign("campaign-2"),
      );

      await expect(
        service.updateMarker({ id: existing.Id.toString(), entityId: "e-1" }),
      ).rejects.toThrow(ValidationError);
    });
  });
});
