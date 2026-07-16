import {
  EntityId,
  EntityRepository,
  NotFoundError,
  Relationship,
  RelationshipId,
  RelationshipRepository,
  ValidationError,
} from "@storyforge/domain";

export interface CreateRelationshipDto {
  campaignId: string;
  sourceEntityId: string;
  targetEntityId: string;
  type: string;
  description?: string | null;
}

export interface UpdateRelationshipDto {
  id: string;
  type?: string;
  description?: string | null;
}

export class RelationshipService {
  constructor(
    private readonly repository: RelationshipRepository,
    private readonly entityRepository: EntityRepository,
  ) {}

  async createRelationship(dto: CreateRelationshipDto): Promise<Relationship> {
    await this.validateEntityInCampaign(dto.campaignId, dto.sourceEntityId);
    await this.validateEntityInCampaign(dto.campaignId, dto.targetEntityId);

    const exists = await this.repository.existsByEdge(
      dto.campaignId,
      dto.sourceEntityId,
      dto.targetEntityId,
      dto.type,
    );

    if (exists) {
      throw new ValidationError(
        "A relationship of this type already exists between these entities.",
      );
    }

    const relationship = Relationship.create(dto);

    await this.repository.create(relationship);

    return relationship;
  }

  async updateRelationship(dto: UpdateRelationshipDto): Promise<Relationship> {
    const relationship = await this.repository.findById(
      RelationshipId.fromString(dto.id),
    );

    if (!relationship) {
      throw new NotFoundError("Relationship not found.");
    }

    if (dto.type !== undefined) {
      relationship.changeType(dto.type);
    }

    if (dto.description !== undefined) {
      relationship.changeDescription(dto.description);
    }

    await this.repository.update(relationship);

    return relationship;
  }

  async deleteRelationship(id: string): Promise<void> {
    const relationship = await this.repository.findById(
      RelationshipId.fromString(id),
    );

    if (!relationship) {
      throw new NotFoundError("Relationship not found.");
    }

    relationship.delete();

    await this.repository.update(relationship);
  }

  async getRelationship(id: string): Promise<Relationship> {
    const relationship = await this.repository.findById(
      RelationshipId.fromString(id),
    );

    if (!relationship) {
      throw new NotFoundError("Relationship not found.");
    }

    return relationship;
  }

  async listRelationshipsByCampaign(
    campaignId: string,
  ): Promise<Relationship[]> {
    return this.repository.findByCampaign(campaignId);
  }

  async listRelationshipsByEntity(entityId: string): Promise<Relationship[]> {
    return this.repository.findByEntity(entityId);
  }

  private async validateEntityInCampaign(
    campaignId: string,
    entityId: string,
  ): Promise<void> {
    const entity = await this.entityRepository.findById(
      EntityId.fromString(entityId),
    );

    if (!entity) {
      throw new NotFoundError(`Entity with ID "${entityId}" not found.`);
    }

    if (entity.CampaignId !== campaignId) {
      throw new ValidationError("Entity does not belong to this campaign.");
    }
  }
}
