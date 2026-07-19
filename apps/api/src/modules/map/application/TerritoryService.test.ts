import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  Entity,
  EntityCategory,
  EntityRepository,
  NotFoundError,
  Territory,
  TerritoryRepository,
  ValidationError,
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
  let entityRepository: EntityRepository;
  let service: TerritoryService;

  beforeEach(() => {
    repository = makeRepository();
    entityRepository = makeEntityRepository();
    service = new TerritoryService(repository, entityRepository);
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

  describe("entity link", () => {
    function entityInCampaign(
      campaignId: string,
      category: EntityCategory = EntityCategory.LOCATION,
    ): Entity {
      return Entity.create({
        campaignId,
        type: "location",
        category,
        name: "Thornwood",
      });
    }

    it("links a territory to a LOCATION-category entity in the same campaign", async () => {
      vi.mocked(entityRepository.findById).mockResolvedValue(
        entityInCampaign("campaign-1", EntityCategory.LOCATION),
      );

      const territory = await service.createTerritory({
        ...createDto,
        entityId: "entity-1",
      });

      expect(territory.EntityId).toBe("entity-1");
    });

    it("links a territory to an ORGANIZATION-category entity in the same campaign", async () => {
      vi.mocked(entityRepository.findById).mockResolvedValue(
        entityInCampaign("campaign-1", EntityCategory.ORGANIZATION),
      );

      const territory = await service.createTerritory({
        ...createDto,
        entityId: "entity-1",
      });

      expect(territory.EntityId).toBe("entity-1");
    });

    it("rejects an entity that is neither ORGANIZATION nor LOCATION-category", async () => {
      vi.mocked(entityRepository.findById).mockResolvedValue(
        entityInCampaign("campaign-1", EntityCategory.CHARACTER),
      );

      await expect(
        service.createTerritory({ ...createDto, entityId: "entity-1" }),
      ).rejects.toThrow(ValidationError);
      expect(repository.create).not.toHaveBeenCalled();
    });

    it("rejects an entity from a different campaign", async () => {
      vi.mocked(entityRepository.findById).mockResolvedValue(
        entityInCampaign("campaign-2"),
      );

      await expect(
        service.createTerritory({ ...createDto, entityId: "entity-1" }),
      ).rejects.toThrow(ValidationError);
      expect(repository.create).not.toHaveBeenCalled();
    });

    it("unlinks on an explicit null without looking the entity up", async () => {
      const existing = Territory.create({ ...createDto, entityId: "entity-1" });
      vi.mocked(repository.findById).mockResolvedValue(existing);

      const territory = await service.updateTerritory({
        id: existing.Id.toString(),
        entityId: null,
      });

      expect(territory.EntityId).toBeNull();
      expect(entityRepository.findById).not.toHaveBeenCalled();
    });
  });
});
