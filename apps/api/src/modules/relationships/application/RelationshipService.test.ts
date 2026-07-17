import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  Entity,
  EntityRepository,
  EntityVisibility,
  NotFoundError,
  Relationship,
  RelationshipRepository,
  ValidationError,
} from "@storyforge/domain";
import { RelationshipService } from "./RelationshipService";

function makeRepository(): RelationshipRepository {
  return {
    findById: vi.fn(),
    findByCampaign: vi.fn(),
    findByEntity: vi.fn(),
    existsByEdge: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
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
  sourceEntityId: "entity-1",
  targetEntityId: "entity-2",
  type: "ALLY",
};

const sourceEntity = Entity.create({
  campaignId: "campaign-1",
  type: "npc",
  name: "Source",
  visibility: EntityVisibility.PUBLIC,
});
const targetEntity = Entity.create({
  campaignId: "campaign-1",
  type: "npc",
  name: "Target",
  visibility: EntityVisibility.PUBLIC,
});

describe("RelationshipService", () => {
  let repository: RelationshipRepository;
  let entityRepository: EntityRepository;
  let service: RelationshipService;

  beforeEach(() => {
    repository = makeRepository();
    entityRepository = makeEntityRepository();
    vi.mocked(entityRepository.findById).mockImplementation(async (id) => {
      if (id.toString() === "entity-1") return sourceEntity;
      if (id.toString() === "entity-2") return targetEntity;
      return null;
    });
    service = new RelationshipService(repository, entityRepository);
  });

  describe("createRelationship", () => {
    it("creates the relationship when no duplicate edge exists", async () => {
      vi.mocked(repository.existsByEdge).mockResolvedValue(false);

      const relationship = await service.createRelationship(createDto);

      expect(relationship.Type).toBe("ALLY");
      expect(repository.create).toHaveBeenCalledWith(relationship);
    });

    it("rejects a duplicate edge in the campaign", async () => {
      vi.mocked(repository.existsByEdge).mockResolvedValue(true);

      await expect(service.createRelationship(createDto)).rejects.toThrow(
        ValidationError,
      );
      expect(repository.create).not.toHaveBeenCalled();
    });

    it("rejects when the source entity belongs to a different campaign", async () => {
      vi.mocked(entityRepository.findById).mockImplementation(async (id) => {
        if (id.toString() === "entity-1")
          return Entity.create({
            campaignId: "other-campaign",
            type: "npc",
            name: "Source",
            visibility: EntityVisibility.PUBLIC,
          });
        if (id.toString() === "entity-2") return targetEntity;
        return null;
      });

      await expect(service.createRelationship(createDto)).rejects.toThrow(
        ValidationError,
      );
      expect(repository.create).not.toHaveBeenCalled();
    });
  });

  describe("updateRelationship", () => {
    it("throws NotFoundError when the relationship does not exist", async () => {
      vi.mocked(repository.findById).mockResolvedValue(null);

      await expect(
        service.updateRelationship({ id: "missing" }),
      ).rejects.toThrow(NotFoundError);
    });

    it("changes type and description", async () => {
      const relationship = Relationship.create(createDto);
      vi.mocked(repository.findById).mockResolvedValue(relationship);

      const updated = await service.updateRelationship({
        id: relationship.Id.toString(),
        type: "ENEMY",
        description: "Falling out",
      });

      expect(updated.Type).toBe("ENEMY");
      expect(updated.Description).toBe("Falling out");
      expect(repository.update).toHaveBeenCalledWith(relationship);
    });
  });

  describe("deleteRelationship", () => {
    it("throws NotFoundError when the relationship does not exist", async () => {
      vi.mocked(repository.findById).mockResolvedValue(null);

      await expect(service.deleteRelationship("missing")).rejects.toThrow(
        NotFoundError,
      );
    });

    it("soft-deletes and persists the relationship", async () => {
      const relationship = Relationship.create(createDto);
      vi.mocked(repository.findById).mockResolvedValue(relationship);

      await service.deleteRelationship(relationship.Id.toString());

      expect(relationship.isDeleted()).toBe(true);
      expect(repository.update).toHaveBeenCalledWith(relationship);
    });
  });

  describe("getRelationship", () => {
    it("throws NotFoundError when the relationship does not exist", async () => {
      vi.mocked(repository.findById).mockResolvedValue(null);

      await expect(service.getRelationship("missing")).rejects.toThrow(
        NotFoundError,
      );
    });

    it("returns the relationship when found", async () => {
      const relationship = Relationship.create(createDto);
      vi.mocked(repository.findById).mockResolvedValue(relationship);

      await expect(
        service.getRelationship(relationship.Id.toString()),
      ).resolves.toBe(relationship);
    });
  });

  describe("listRelationshipsByCampaign", () => {
    it("delegates to the repository", async () => {
      const relationships = [Relationship.create(createDto)];
      vi.mocked(repository.findByCampaign).mockResolvedValue(relationships);

      await expect(
        service.listRelationshipsByCampaign("campaign-1"),
      ).resolves.toBe(relationships);
      expect(repository.findByCampaign).toHaveBeenCalledWith("campaign-1");
    });
  });

  describe("listRelationshipsByEntity", () => {
    it("delegates to the repository", async () => {
      const relationships = [Relationship.create(createDto)];
      vi.mocked(repository.findByEntity).mockResolvedValue(relationships);

      await expect(
        service.listRelationshipsByEntity("campaign-1", "entity-1"),
      ).resolves.toBe(relationships);
      expect(repository.findByEntity).toHaveBeenCalledWith(
        "campaign-1",
        "entity-1",
      );
    });
  });
});
