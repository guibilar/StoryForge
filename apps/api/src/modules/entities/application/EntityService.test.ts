import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  Entity,
  EntityCategory,
  EntityRepository,
  EntityVisibility,
  NoteLinkRepository,
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

function makeNoteLinkRepository(): NoteLinkRepository {
  return {
    findByNote: vi.fn(),
    findByTargetEntity: vi.fn(),
    findByTargetNote: vi.fn(),
    replaceForNote: vi.fn(),
    deleteByNote: vi.fn(),
    deleteByTargetEntity: vi.fn(),
  };
}

const createDto = {
  campaignId: "campaign-1",
  type: "npc",
  category: EntityCategory.CHARACTER,
  name: "Goblin",
  visibility: EntityVisibility.PUBLIC,
};

describe("EntityService", () => {
  let repository: EntityRepository;
  let noteLinkRepository: NoteLinkRepository;
  let service: EntityService;

  beforeEach(() => {
    repository = makeRepository();
    noteLinkRepository = makeNoteLinkRepository();
    service = new EntityService(repository, noteLinkRepository);
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

    it("flags an existing CHARACTER entity as a Player Character", async () => {
      const entity = Entity.create(createDto);
      vi.mocked(repository.findById).mockResolvedValue(entity);

      const updated = await service.updateEntity({
        id: entity.Id.toString(),
        isPlayerCharacter: true,
      });

      expect(updated.IsPlayerCharacter).toBe(true);
    });

    it("moves category to CHARACTER and flags Player Character in the same call", async () => {
      const entity = Entity.create({
        ...createDto,
        category: EntityCategory.LOCATION,
      });
      vi.mocked(repository.findById).mockResolvedValue(entity);

      const updated = await service.updateEntity({
        id: entity.Id.toString(),
        category: EntityCategory.CHARACTER,
        isPlayerCharacter: true,
      });

      expect(updated.Category).toBe(EntityCategory.CHARACTER);
      expect(updated.IsPlayerCharacter).toBe(true);
    });

    it("un-flags Player Character and moves category away from CHARACTER in the same call", async () => {
      const entity = Entity.create({ ...createDto, isPlayerCharacter: true });
      vi.mocked(repository.findById).mockResolvedValue(entity);

      const updated = await service.updateEntity({
        id: entity.Id.toString(),
        category: EntityCategory.LOCATION,
        isPlayerCharacter: false,
      });

      expect(updated.Category).toBe(EntityCategory.LOCATION);
      expect(updated.IsPlayerCharacter).toBe(false);
    });

    it("rejects moving category away from CHARACTER while still flagged as a Player Character", async () => {
      const entity = Entity.create({ ...createDto, isPlayerCharacter: true });
      vi.mocked(repository.findById).mockResolvedValue(entity);

      await expect(
        service.updateEntity({
          id: entity.Id.toString(),
          category: EntityCategory.LOCATION,
        }),
      ).rejects.toThrow(ValidationError);
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

    it("cleans up NoteLinks that target the deleted entity", async () => {
      const entity = Entity.create(createDto);
      vi.mocked(repository.findById).mockResolvedValue(entity);

      await service.deleteEntity(entity.Id.toString());

      expect(noteLinkRepository.deleteByTargetEntity).toHaveBeenCalledWith(
        entity.Id.toString(),
      );
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

  describe("setEntityImage", () => {
    it("throws NotFoundError when the entity does not exist", async () => {
      vi.mocked(repository.findById).mockResolvedValue(null);

      await expect(
        service.setEntityImage("missing", "/uploads/missing/a.png"),
      ).rejects.toThrow(NotFoundError);
    });

    it("sets the image and persists the entity", async () => {
      const entity = Entity.create(createDto);
      vi.mocked(repository.findById).mockResolvedValue(entity);

      const updated = await service.setEntityImage(
        entity.Id.toString(),
        "/uploads/entity-1/a.png",
      );

      expect(updated.Image).toBe("/uploads/entity-1/a.png");
      expect(repository.update).toHaveBeenCalledWith(entity);
    });
  });

  describe("listEntities", () => {
    it("delegates to the repository without a filter", async () => {
      const entities = [Entity.create(createDto)];
      vi.mocked(repository.findByCampaign).mockResolvedValue(entities);

      await expect(service.listEntities("campaign-1")).resolves.toBe(entities);
      expect(repository.findByCampaign).toHaveBeenCalledWith(
        "campaign-1",
        undefined,
      );
    });

    it("passes the filter through to the repository unchanged", async () => {
      vi.mocked(repository.findByCampaign).mockResolvedValue([]);
      const filter = { type: "npc", nameContains: "gob", tagIds: ["tag-1"] };

      await service.listEntities("campaign-1", filter);

      expect(repository.findByCampaign).toHaveBeenCalledWith(
        "campaign-1",
        filter,
      );
    });
  });
});
