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

    let tag = await this.tagRepository.findByCampaignAndName(
      entity.CampaignId,
      name,
    );

    if (!tag) {
      tag = Tag.create({ campaignId: entity.CampaignId, name });
      await this.tagRepository.create(tag);
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
