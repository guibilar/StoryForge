import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CampaignMember,
  CampaignMemberRepository,
  Entity,
  EntityCategory,
  EntityRepository,
  EntityVisibility,
  NoteLinkRepository,
  NotFoundError,
  UserId,
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

function makeCampaignMemberRepository(): CampaignMemberRepository {
  return {
    listByCampaign: vi.fn(),
    findByCampaignAndUser: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    transferOwnership: vi.fn(),
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
  let campaignMemberRepository: CampaignMemberRepository;
  let service: EntityService;

  beforeEach(() => {
    repository = makeRepository();
    noteLinkRepository = makeNoteLinkRepository();
    campaignMemberRepository = makeCampaignMemberRepository();
    service = new EntityService(
      repository,
      noteLinkRepository,
      campaignMemberRepository,
    );
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

    it("creates a Player Character with an owner already a member of the campaign", async () => {
      vi.mocked(repository.existsByName).mockResolvedValue(false);
      const member = CampaignMember.create({
        campaignId: "campaign-1",
        userId: UserId.create(),
        role: "PLAYER",
      });
      vi.mocked(
        campaignMemberRepository.findByCampaignAndUser,
      ).mockResolvedValue(member);

      const entity = await service.createEntity({
        ...createDto,
        isPlayerCharacter: true,
        ownerUserId: member.UserId.toString(),
      });

      expect(entity.OwnerUserId).toBe(member.UserId.toString());
    });

    it("rejects an owner who isn't a member of the entity's campaign", async () => {
      vi.mocked(repository.existsByName).mockResolvedValue(false);
      vi.mocked(
        campaignMemberRepository.findByCampaignAndUser,
      ).mockResolvedValue(null);

      await expect(
        service.createEntity({
          ...createDto,
          isPlayerCharacter: true,
          ownerUserId: UserId.create().toString(),
        }),
      ).rejects.toThrow(NotFoundError);
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

    it("changes and clears the color", async () => {
      const entity = Entity.create(createDto);
      vi.mocked(repository.findById).mockResolvedValue(entity);

      const updated = await service.updateEntity({
        id: entity.Id.toString(),
        color: "#4287f5",
      });
      expect(updated.Color).toBe("#4287f5");

      const cleared = await service.updateEntity({
        id: entity.Id.toString(),
        color: null,
      });
      expect(cleared.Color).toBeNull();
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

    it("hides and un-hides a non-CHARACTER entity from the graph", async () => {
      const entity = Entity.create({
        ...createDto,
        category: EntityCategory.ITEM,
        hiddenFromGraph: false,
      });
      vi.mocked(repository.findById).mockResolvedValue(entity);

      const hidden = await service.updateEntity({
        id: entity.Id.toString(),
        hiddenFromGraph: true,
      });
      expect(hidden.HiddenFromGraph).toBe(true);

      const shown = await service.updateEntity({
        id: entity.Id.toString(),
        hiddenFromGraph: false,
      });
      expect(shown.HiddenFromGraph).toBe(false);
    });

    it("rejects hiding a CHARACTER entity from the graph", async () => {
      const entity = Entity.create(createDto);
      vi.mocked(repository.findById).mockResolvedValue(entity);

      await expect(
        service.updateEntity({
          id: entity.Id.toString(),
          hiddenFromGraph: true,
        }),
      ).rejects.toThrow(ValidationError);
    });

    it("accepts hiddenFromGraph true when demoting out of CHARACTER in the same call", async () => {
      const entity = Entity.create(createDto);
      vi.mocked(repository.findById).mockResolvedValue(entity);

      const updated = await service.updateEntity({
        id: entity.Id.toString(),
        category: EntityCategory.ITEM,
        hiddenFromGraph: true,
      });

      expect(updated.Category).toBe(EntityCategory.ITEM);
      expect(updated.HiddenFromGraph).toBe(true);
    });

    it("links an owner already a member of the entity's campaign", async () => {
      const entity = Entity.create({ ...createDto, isPlayerCharacter: true });
      vi.mocked(repository.findById).mockResolvedValue(entity);
      const member = CampaignMember.create({
        campaignId: entity.CampaignId,
        userId: UserId.create(),
        role: "PLAYER",
      });
      vi.mocked(
        campaignMemberRepository.findByCampaignAndUser,
      ).mockResolvedValue(member);

      const updated = await service.updateEntity({
        id: entity.Id.toString(),
        ownerUserId: member.UserId.toString(),
      });

      expect(updated.OwnerUserId).toBe(member.UserId.toString());
      expect(
        campaignMemberRepository.findByCampaignAndUser,
      ).toHaveBeenCalledWith(entity.CampaignId, member.UserId);
    });

    it("clears the owner when ownerUserId is set to null", async () => {
      const entity = Entity.create({ ...createDto, isPlayerCharacter: true });
      entity.linkOwner("user-1");
      vi.mocked(repository.findById).mockResolvedValue(entity);

      const updated = await service.updateEntity({
        id: entity.Id.toString(),
        ownerUserId: null,
      });

      expect(updated.OwnerUserId).toBeNull();
      expect(
        campaignMemberRepository.findByCampaignAndUser,
      ).not.toHaveBeenCalled();
    });

    it("rejects an owner who isn't a member of the entity's campaign", async () => {
      const entity = Entity.create({ ...createDto, isPlayerCharacter: true });
      vi.mocked(repository.findById).mockResolvedValue(entity);
      vi.mocked(
        campaignMemberRepository.findByCampaignAndUser,
      ).mockResolvedValue(null);

      await expect(
        service.updateEntity({
          id: entity.Id.toString(),
          ownerUserId: UserId.create().toString(),
        }),
      ).rejects.toThrow(NotFoundError);
      expect(repository.update).not.toHaveBeenCalled();
    });

    it("un-flags Player Character and clears its owner in the same call", async () => {
      const entity = Entity.create({ ...createDto, isPlayerCharacter: true });
      entity.linkOwner("user-1");
      vi.mocked(repository.findById).mockResolvedValue(entity);

      const updated = await service.updateEntity({
        id: entity.Id.toString(),
        isPlayerCharacter: false,
        ownerUserId: null,
      });

      expect(updated.IsPlayerCharacter).toBe(false);
      expect(updated.OwnerUserId).toBeNull();
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
