import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  Entity,
  EntityRepository,
  EntityVisibility,
  NotFoundError,
  ValidationError,
} from "@storyforge/domain";
import { EntityService } from "./EntityService";

function makeRepository(): EntityRepository {
  return {
    findById: vi.fn(),
    findByCampaign: vi.fn(),
    existsByName: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  };
}

const createDto = {
  campaignId: "campaign-1",
  type: "npc",
  name: "Goblin",
  visibility: EntityVisibility.PUBLIC,
};

describe("EntityService", () => {
  let repository: EntityRepository;
  let service: EntityService;

  beforeEach(() => {
    repository = makeRepository();
    service = new EntityService(repository);
  });

  describe("createEntity", () => {
    it("creates the entity when the name is free", async () => {
      vi.mocked(repository.existsByName).mockResolvedValue(false);

      const entity = await service.createEntity(createDto);

      expect(entity.Name).toBe("Goblin");
      expect(repository.create).toHaveBeenCalledWith(entity);
    });

    it("rejects a duplicate name within the campaign", async () => {
      vi.mocked(repository.existsByName).mockResolvedValue(true);

      await expect(service.createEntity(createDto)).rejects.toThrow(
        ValidationError,
      );
      expect(repository.create).not.toHaveBeenCalled();
    });
  });

  describe("updateEntity", () => {
    it("throws NotFoundError when the entity does not exist", async () => {
      vi.mocked(repository.findById).mockResolvedValue(null);

      await expect(service.updateEntity({ id: "missing" })).rejects.toThrow(
        NotFoundError,
      );
    });

    it("updates fields without checking name uniqueness when name is unchanged", async () => {
      const entity = Entity.create(createDto);
      vi.mocked(repository.findById).mockResolvedValue(entity);

      await service.updateEntity({
        id: entity.Id.toString(),
        name: entity.Name,
        description: "New description",
      });

      expect(repository.existsByName).not.toHaveBeenCalled();
      expect(entity.Description).toBe("New description");
    });

    it("rejects renaming to a name already used in the campaign", async () => {
      const entity = Entity.create(createDto);
      vi.mocked(repository.findById).mockResolvedValue(entity);
      vi.mocked(repository.existsByName).mockResolvedValue(true);

      await expect(
        service.updateEntity({ id: entity.Id.toString(), name: "Orc" }),
      ).rejects.toThrow(ValidationError);
      expect(repository.update).not.toHaveBeenCalled();
    });

    it("renames, changes icon and visibility", async () => {
      const entity = Entity.create(createDto);
      vi.mocked(repository.findById).mockResolvedValue(entity);
      vi.mocked(repository.existsByName).mockResolvedValue(false);

      const updated = await service.updateEntity({
        id: entity.Id.toString(),
        name: "Orc",
        icon: "orc.png",
        visibility: EntityVisibility.PRIVATE,
      });

      expect(updated.Name).toBe("Orc");
      expect(updated.Icon).toBe("orc.png");
      expect(updated.Visibility).toBe(EntityVisibility.PRIVATE);
      expect(repository.update).toHaveBeenCalledWith(entity);
    });
  });

  describe("deleteEntity", () => {
    it("throws NotFoundError when the entity does not exist", async () => {
      vi.mocked(repository.findById).mockResolvedValue(null);

      await expect(service.deleteEntity("missing")).rejects.toThrow(
        NotFoundError,
      );
    });

    it("soft-deletes and persists the entity", async () => {
      const entity = Entity.create(createDto);
      vi.mocked(repository.findById).mockResolvedValue(entity);

      await service.deleteEntity(entity.Id.toString());

      expect(entity.isDeleted()).toBe(true);
      expect(repository.update).toHaveBeenCalledWith(entity);
    });
  });

  describe("getEntity", () => {
    it("throws NotFoundError when the entity does not exist", async () => {
      vi.mocked(repository.findById).mockResolvedValue(null);

      await expect(service.getEntity("missing")).rejects.toThrow(NotFoundError);
    });

    it("returns the entity when found", async () => {
      const entity = Entity.create(createDto);
      vi.mocked(repository.findById).mockResolvedValue(entity);

      await expect(service.getEntity(entity.Id.toString())).resolves.toBe(
        entity,
      );
    });
  });

  describe("listEntities", () => {
    it("delegates to the repository", async () => {
      const entities = [Entity.create(createDto)];
      vi.mocked(repository.findByCampaign).mockResolvedValue(entities);

      await expect(service.listEntities("campaign-1")).resolves.toBe(entities);
      expect(repository.findByCampaign).toHaveBeenCalledWith("campaign-1");
    });
  });
});
