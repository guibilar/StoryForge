import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  NotFoundError,
  Territory,
  TerritoryRepository,
} from "@storyforge/domain";
import { TerritoryService } from "./TerritoryService";

function makeRepository(): TerritoryRepository {
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
  name: "Thornwood",
  type: "region",
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
        [0, 0],
      ],
    ],
  },
};

describe("TerritoryService", () => {
  let repository: TerritoryRepository;
  let service: TerritoryService;

  beforeEach(() => {
    repository = makeRepository();
    service = new TerritoryService(repository);
  });

  describe("createTerritory", () => {
    it("creates and persists a territory", async () => {
      const territory = await service.createTerritory(createDto);

      expect(territory.Name).toBe("Thornwood");
      expect(repository.create).toHaveBeenCalledWith(territory);
    });
  });

  describe("updateTerritory", () => {
    it("throws NotFoundError when the territory does not exist", async () => {
      vi.mocked(repository.findById).mockResolvedValue(null);

      await expect(service.updateTerritory({ id: "missing" })).rejects.toThrow(
        NotFoundError,
      );
    });

    it("renames, changes type, geometry, and description", async () => {
      const territory = Territory.create(createDto);
      vi.mocked(repository.findById).mockResolvedValue(territory);
      const newGeometry = { type: "Point", coordinates: [1, 2] };

      const updated = await service.updateTerritory({
        id: territory.Id.toString(),
        name: "Blackwood",
        type: "district",
        geometry: newGeometry,
        description: "Updated.",
      });

      expect(updated.Name).toBe("Blackwood");
      expect(updated.Type).toBe("district");
      expect(updated.Geometry).toEqual(newGeometry);
      expect(updated.Description).toBe("Updated.");
      expect(repository.update).toHaveBeenCalledWith(territory);
    });
  });

  describe("deleteTerritory", () => {
    it("throws NotFoundError when the territory does not exist", async () => {
      vi.mocked(repository.findById).mockResolvedValue(null);

      await expect(service.deleteTerritory("missing")).rejects.toThrow(
        NotFoundError,
      );
      expect(repository.delete).not.toHaveBeenCalled();
    });

    it("deletes the territory", async () => {
      const territory = Territory.create(createDto);
      vi.mocked(repository.findById).mockResolvedValue(territory);

      await service.deleteTerritory(territory.Id.toString());

      expect(repository.delete).toHaveBeenCalledWith(territory.Id);
    });
  });

  describe("getTerritory", () => {
    it("throws NotFoundError when the territory does not exist", async () => {
      vi.mocked(repository.findById).mockResolvedValue(null);

      await expect(service.getTerritory("missing")).rejects.toThrow(
        NotFoundError,
      );
    });

    it("returns the territory when found", async () => {
      const territory = Territory.create(createDto);
      vi.mocked(repository.findById).mockResolvedValue(territory);

      await expect(service.getTerritory(territory.Id.toString())).resolves.toBe(
        territory,
      );
    });
  });

  describe("listTerritories", () => {
    it("delegates to the repository", async () => {
      const territories = [Territory.create(createDto)];
      vi.mocked(repository.findByCampaign).mockResolvedValue(territories);

      await expect(service.listTerritories("campaign-1")).resolves.toBe(
        territories,
      );
      expect(repository.findByCampaign).toHaveBeenCalledWith("campaign-1");
    });
  });
});
