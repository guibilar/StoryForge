import {
  Entity,
  EntityId,
  EntityRepository,
  NotFoundError,
  Tag,
  TagId,
  TagRepository,
} from "@storyforge/domain";

export class TagService {
  constructor(
    private readonly tagRepository: TagRepository,
    private readonly entityRepository: EntityRepository,
  ) {}

  listCampaignTags(campaignId: string) {
    return this.tagRepository.findByCampaign(campaignId);
  }

  async listEntityTags(entityId: string) {
    await this.getEntityOrThrow(entityId);

    return this.tagRepository.findByEntity(entityId);
  }

  async addTagToEntity(entityId: string, name: string): Promise<Entity> {
    const entity = await this.getEntityOrThrow(entityId);
    const normalizedName = Tag.normalize(name);

    let tag = await this.tagRepository.findByCampaignAndName(
      entity.CampaignId,
      normalizedName,
    );

    if (!tag) {
      await this.tagRepository.create(
        Tag.create({ campaignId: entity.CampaignId, name }),
      );
      // Re-fetch rather than reusing the in-memory Tag: a concurrent
      // addTagToEntity call for the same name may have won the race and
      // persisted a different id, which create() swallows as a no-op.
      tag = await this.tagRepository.findByCampaignAndName(
        entity.CampaignId,
        normalizedName,
      );
    }

    if (!tag) {
      throw new NotFoundError("Tag not found after creation.");
    }

    await this.tagRepository.attachToEntity(tag.Id, entityId);

    return entity;
  }

  async removeTagFromEntity(entityId: string, tagId: string): Promise<Entity> {
    const entity = await this.getEntityOrThrow(entityId);

    await this.tagRepository.detachFromEntity(
      TagId.fromString(tagId),
      entityId,
    );

    return entity;
  }

  private async getEntityOrThrow(entityId: string): Promise<Entity> {
    const entity = await this.entityRepository.findById(
      EntityId.fromString(entityId),
    );

    if (!entity) {
      throw new NotFoundError("Entity not found.");
    }

    return entity;
  }
}
