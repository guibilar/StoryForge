import {
  Entity,
  EntityId,
  EntityRepository,
  EntityVisibility,
  NotFoundError,
  ValidationError,
} from "@storyforge/domain";

export interface CreateEntityDto {
  campaignId: string;
  type: string;
  name: string;
  description?: string | null;
  icon?: string | null;
  visibility: EntityVisibility;
}

export interface UpdateEntityDto {
  id: string;
  name?: string;
  description?: string | null;
  icon?: string | null;
  visibility?: EntityVisibility;
}

export class EntityService {
  constructor(private readonly repository: EntityRepository) {}

  async createEntity(dto: CreateEntityDto): Promise<Entity> {
    const exists = await this.repository.existsByName(dto.campaignId, dto.name);

    if (exists) {
      throw new ValidationError(
        "An entity with this name already exists in this campaign.",
      );
    }

    const entity = Entity.create(dto);

    await this.repository.create(entity);

    return entity;
  }

  async updateEntity(dto: UpdateEntityDto): Promise<Entity> {
    const entity = await this.repository.findById(EntityId.fromString(dto.id));

    if (!entity) {
      throw new NotFoundError("Entity not found.");
    }

    if (
      dto.name &&
      dto.name !== entity.Name &&
      (await this.repository.existsByName(entity.CampaignId, dto.name))
    ) {
      throw new ValidationError(
        "An entity with this name already exists in this campaign.",
      );
    }

    if (dto.name !== undefined) {
      entity.rename(dto.name);
    }

    if (dto.description !== undefined) {
      entity.changeDescription(dto.description);
    }

    if (dto.icon !== undefined) {
      entity.changeIcon(dto.icon);
    }

    if (dto.visibility !== undefined) {
      entity.changeVisibility(dto.visibility);
    }

    await this.repository.update(entity);

    return entity;
  }

  async deleteEntity(id: string): Promise<void> {
    const entity = await this.repository.findById(EntityId.fromString(id));

    if (!entity) {
      throw new NotFoundError("Entity not found.");
    }

    entity.delete();

    await this.repository.update(entity);
  }

  async getEntity(id: string): Promise<Entity> {
    const entity = await this.repository.findById(EntityId.fromString(id));

    if (!entity) {
      throw new NotFoundError("Entity not found.");
    }

    return entity;
  }

  async listEntities(campaignId: string): Promise<Entity[]> {
    return this.repository.findByCampaign(campaignId);
  }
}
