import {
  NotFoundError,
  Relationship,
  RelationshipId,
  RelationshipRepository,
  RelationshipType,
  ValidationError,
} from "@storyforge/domain";

export interface CreateRelationshipDto {
  campaignId: string;
  sourceEntityId: string;
  targetEntityId: string;
  type: RelationshipType;
  description?: string | null;
}

export interface UpdateRelationshipDto {
  id: string;
  type?: RelationshipType;
  description?: string | null;
}

export class RelationshipService {
  constructor(private readonly repository: RelationshipRepository) {}

  async createRelationship(dto: CreateRelationshipDto): Promise<Relationship> {
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
}
