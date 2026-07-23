import {
  CampaignMemberRepository,
  EntityId,
  EntityRepository,
  NotFoundError,
  Relationship,
  RelationshipEndpoint,
  RelationshipId,
  RelationshipRepository,
  RelationshipVisibility,
  UserId,
  ValidationError,
} from "@storyforge/domain";

export interface CreateRelationshipDto {
  campaignId: string;
  sourceEntityId: string;
  targetEntityId: string;
  type: string;
  description?: string | null;
  visibility?: RelationshipVisibility;
  recipientIds?: string[];
  concealedEndpoint?: RelationshipEndpoint | null;
}

export interface UpdateRelationshipDto {
  id: string;
  type?: string;
  description?: string | null;
  visibility?: RelationshipVisibility;
  recipientIds?: string[];
  concealedEndpoint?: RelationshipEndpoint | null;
}

export class RelationshipService {
  constructor(
    private readonly repository: RelationshipRepository,
    private readonly entityRepository: EntityRepository,
    private readonly campaignMemberRepository: CampaignMemberRepository,
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

    const relationship = Relationship.create({
      ...dto,
      recipientIds: await this.resolveRecipients(
        dto.campaignId,
        dto.recipientIds ?? [],
      ),
    });

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

    if (dto.visibility !== undefined || dto.recipientIds !== undefined) {
      const visibility = dto.visibility ?? relationship.Visibility;
      // Recipients not sent: keep them when the level is unchanged, drop
      // them when it changes. Mirrors NoteService.updateNote.
      const recipientIds =
        dto.recipientIds !== undefined
          ? await this.resolveRecipients(
              relationship.CampaignId,
              dto.recipientIds,
            )
          : visibility === relationship.Visibility
            ? relationship.RecipientIds
            : [];

      relationship.changeVisibility(visibility, recipientIds);
    }

    if (dto.concealedEndpoint !== undefined) {
      relationship.changeConcealedEndpoint(dto.concealedEndpoint);
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

  async listRelationshipsByEntity(
    campaignId: string,
    entityId: string,
  ): Promise<Relationship[]> {
    return this.repository.findByEntity(campaignId, entityId);
  }

  private async resolveRecipients(
    campaignId: string,
    recipientIds: string[],
  ): Promise<UserId[]> {
    const userIds = recipientIds.map((id) => UserId.fromString(id));

    const memberships = await Promise.all(
      userIds.map((userId) =>
        this.campaignMemberRepository.findByCampaignAndUser(campaignId, userId),
      ),
    );

    if (memberships.some((membership) => membership === null)) {
      throw new ValidationError(
        "All relationship recipients must be members of the campaign.",
      );
    }

    return userIds;
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
