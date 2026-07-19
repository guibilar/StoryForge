import {
  Entity,
  EntityCategory,
  EntityFilter,
  EntityId,
  EntityRepository,
  EntityVisibility,
  NoteLinkRepository,
  NotFoundError,
  ValidationError,
} from "@storyforge/domain";

export interface CreateEntityDto {
  campaignId: string;
  type: string;
  category: EntityCategory;
  name: string;
  description?: string | null;
  icon?: string | null;
  image?: string | null;
  visibility: EntityVisibility;
  isPlayerCharacter?: boolean;
}

export interface UpdateEntityDto {
  id: string;
  name?: string;
  category?: EntityCategory;
  description?: string | null;
  icon?: string | null;
  image?: string | null;
  visibility?: EntityVisibility;
  isPlayerCharacter?: boolean;
}

export class EntityService {
  constructor(
    private readonly repository: EntityRepository,
    private readonly noteLinkRepository: NoteLinkRepository,
  ) {}

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

    // Order matters when both fields change in the same call: category and
    // isPlayerCharacter validate against each other's *current* value
    // (Entity.changeCategory/changeIsPlayerCharacter), so applying them in
    // the wrong order can reject a transition that is valid end-to-end (e.g.
    // category CHARACTER->LOCATION + isPlayerCharacter true->false). Apply
    // whichever change moves toward the final isPlayerCharacter=false state
    // first, since false is always valid regardless of category.
    const finalIsPlayerCharacter =
      dto.isPlayerCharacter ?? entity.IsPlayerCharacter;

    const applyCategory = () => {
      if (dto.category !== undefined) {
        entity.changeCategory(dto.category);
      }
    };
    const applyIsPlayerCharacter = () => {
      if (dto.isPlayerCharacter !== undefined) {
        entity.changeIsPlayerCharacter(dto.isPlayerCharacter);
      }
    };

    if (finalIsPlayerCharacter) {
      applyCategory();
      applyIsPlayerCharacter();
    } else {
      applyIsPlayerCharacter();
      applyCategory();
    }

    if (dto.description !== undefined) {
      entity.changeDescription(dto.description);
    }

    if (dto.icon !== undefined) {
      entity.changeIcon(dto.icon);
    }

    if (dto.image !== undefined) {
      entity.changeImage(dto.image);
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
    await this.noteLinkRepository.deleteByTargetEntity(id);
  }

  // Nullable counterpart to getEntity, for callers holding a reference that
  // may no longer resolve. Entities are soft-deleted (deletedAt) and
  // findById filters those out, so a Marker/Territory entityId can outlive
  // the entity it points at — the database's ON DELETE SET NULL only fires
  // on a hard delete. Mirrors SessionService.findSession.
  async findEntity(id: string): Promise<Entity | null> {
    return this.repository.findById(EntityId.fromString(id));
  }

  async getEntity(id: string): Promise<Entity> {
    const entity = await this.repository.findById(EntityId.fromString(id));

    if (!entity) {
      throw new NotFoundError("Entity not found.");
    }

    return entity;
  }

  async setEntityImage(id: string, image: string): Promise<Entity> {
    const entity = await this.repository.findById(EntityId.fromString(id));

    if (!entity) {
      throw new NotFoundError("Entity not found.");
    }

    entity.changeImage(image);

    await this.repository.update(entity);

    return entity;
  }

  async listEntities(
    campaignId: string,
    filter?: EntityFilter | null,
  ): Promise<Entity[]> {
    return this.repository.findByCampaign(campaignId, filter);
  }
}
