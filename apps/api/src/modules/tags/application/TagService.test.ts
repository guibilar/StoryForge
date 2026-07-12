import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  Entity,
  EntityRepository,
  EntityVisibility,
  NotFoundError,
  Tag,
  TagRepository,
} from "@storyforge/domain";
import { TagService } from "./TagService";

function makeTagRepository(): TagRepository {
  return {
    findById: vi.fn(),
    findByCampaign: vi.fn(),
    findByCampaignAndName: vi.fn(),
    findByEntity: vi.fn(),
    create: vi.fn(),
    attachToEntity: vi.fn(),
    detachFromEntity: vi.fn(),
  };
}

function makeEntityRepository(): EntityRepository {
  return {
    findById: vi.fn(),
    findByCampaign: vi.fn(),
    existsByName: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  };
}

const entity = Entity.create({
  campaignId: "campaign-1",
  type: "npc",
  name: "Goblin",
  visibility: EntityVisibility.PUBLIC,
});

describe("TagService", () => {
  let tagRepository: TagRepository;
  let entityRepository: EntityRepository;
  let service: TagService;

  beforeEach(() => {
    tagRepository = makeTagRepository();
    entityRepository = makeEntityRepository();
    service = new TagService(tagRepository, entityRepository);
  });

  describe("listCampaignTags", () => {
    it("delegates to the repository", async () => {
      const tags = [
        Tag.create({ campaignId: "campaign-1", name: "status:dead" }),
      ];
      vi.mocked(tagRepository.findByCampaign).mockResolvedValue(tags);

      await expect(service.listCampaignTags("campaign-1")).resolves.toBe(tags);
      expect(tagRepository.findByCampaign).toHaveBeenCalledWith("campaign-1");
    });
  });

  describe("listEntityTags", () => {
    it("throws NotFoundError when the entity does not exist", async () => {
      vi.mocked(entityRepository.findById).mockResolvedValue(null);

      await expect(service.listEntityTags("missing")).rejects.toThrow(
        NotFoundError,
      );
      expect(tagRepository.findByEntity).not.toHaveBeenCalled();
    });

    it("returns the entity's tags", async () => {
      vi.mocked(entityRepository.findById).mockResolvedValue(entity);
      const tags = [
        Tag.create({ campaignId: "campaign-1", name: "status:dead" }),
      ];
      vi.mocked(tagRepository.findByEntity).mockResolvedValue(tags);

      await expect(service.listEntityTags(entity.Id.toString())).resolves.toBe(
        tags,
      );
      expect(tagRepository.findByEntity).toHaveBeenCalledWith(
        entity.Id.toString(),
      );
    });
  });

  describe("addTagToEntity", () => {
    it("throws NotFoundError when the entity does not exist", async () => {
      vi.mocked(entityRepository.findById).mockResolvedValue(null);

      await expect(
        service.addTagToEntity("missing", "faction:thieves-guild"),
      ).rejects.toThrow(NotFoundError);
      expect(tagRepository.create).not.toHaveBeenCalled();
      expect(tagRepository.attachToEntity).not.toHaveBeenCalled();
    });

    it("reuses an existing tag in the campaign instead of creating a new one", async () => {
      vi.mocked(entityRepository.findById).mockResolvedValue(entity);
      const existingTag = Tag.create({
        campaignId: entity.CampaignId,
        name: "faction:thieves-guild",
      });
      vi.mocked(tagRepository.findByCampaignAndName).mockResolvedValue(
        existingTag,
      );

      const result = await service.addTagToEntity(
        entity.Id.toString(),
        "Faction:Thieves-Guild",
      );

      expect(tagRepository.findByCampaignAndName).toHaveBeenCalledWith(
        entity.CampaignId,
        "Faction:Thieves-Guild",
      );
      expect(tagRepository.create).not.toHaveBeenCalled();
      expect(tagRepository.attachToEntity).toHaveBeenCalledTimes(1);
      const [attachedTagId, attachedEntityId] = vi.mocked(
        tagRepository.attachToEntity,
      ).mock.calls[0];
      expect(attachedTagId.equals(existingTag.Id)).toBe(true);
      expect(attachedEntityId).toBe(entity.Id.toString());
      expect(result).toBe(entity);
    });

    it("creates a new tag when none exists for the campaign yet", async () => {
      vi.mocked(entityRepository.findById).mockResolvedValue(entity);
      vi.mocked(tagRepository.findByCampaignAndName).mockResolvedValue(null);

      await service.addTagToEntity(entity.Id.toString(), "status:dead");

      expect(tagRepository.create).toHaveBeenCalledTimes(1);
      const createdTag = vi.mocked(tagRepository.create).mock.calls[0][0];
      expect(createdTag.Name).toBe("status:dead");
      expect(createdTag.CampaignId).toBe(entity.CampaignId);
      expect(tagRepository.attachToEntity).toHaveBeenCalledWith(
        createdTag.Id,
        entity.Id.toString(),
      );
    });
  });

  describe("removeTagFromEntity", () => {
    it("throws NotFoundError when the entity does not exist", async () => {
      vi.mocked(entityRepository.findById).mockResolvedValue(null);

      await expect(
        service.removeTagFromEntity("missing", "tag-1"),
      ).rejects.toThrow(NotFoundError);
      expect(tagRepository.detachFromEntity).not.toHaveBeenCalled();
    });

    it("detaches the tag and returns the entity", async () => {
      vi.mocked(entityRepository.findById).mockResolvedValue(entity);
      const tag = Tag.create({
        campaignId: entity.CampaignId,
        name: "status:dead",
      });

      const result = await service.removeTagFromEntity(
        entity.Id.toString(),
        tag.Id.toString(),
      );

      expect(tagRepository.detachFromEntity).toHaveBeenCalledTimes(1);
      const [detachedTagId, detachedEntityId] = vi.mocked(
        tagRepository.detachFromEntity,
      ).mock.calls[0];
      expect(detachedTagId.equals(tag.Id)).toBe(true);
      expect(detachedEntityId).toBe(entity.Id.toString());
      expect(result).toBe(entity);
    });
  });
});
