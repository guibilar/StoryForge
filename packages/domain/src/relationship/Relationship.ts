import { ValidationError } from "../shared";
import type { UserId } from "../user";
import { RelationshipEndpoint } from "./RelationshipEndpoint";
import { RelationshipId } from "./RelationshipId";
import { RelationshipVisibility } from "./RelationshipVisibility";

export interface CreateRelationshipProps {
  campaignId: string;
  sourceEntityId: string;
  targetEntityId: string;
  type: string;
  description?: string | null;
  visibility?: RelationshipVisibility;
  recipientIds?: UserId[];
  concealedEndpoint?: RelationshipEndpoint | null;
}

export interface RehydrateRelationshipProps {
  id: RelationshipId;
  campaignId: string;
  sourceEntityId: string;
  targetEntityId: string;
  type: string;
  description: string | null;
  visibility: RelationshipVisibility;
  recipientIds: UserId[];
  concealedEndpoint: RelationshipEndpoint | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export class Relationship {
  private constructor(
    private readonly idValue: RelationshipId,
    private readonly campaignIdValue: string,
    private readonly sourceEntityIdValue: string,
    private readonly targetEntityIdValue: string,
    private typeValue: string,
    private descriptionValue: string | null,
    private visibilityValue: RelationshipVisibility,
    private recipientIdsValue: UserId[],
    private concealedEndpointValue: RelationshipEndpoint | null,
    private readonly createdAtValue: Date,
    private updatedAtValue: Date,
    private deletedAtValue: Date | null,
  ) {
    this.validateNoSelfRelationship(sourceEntityIdValue, targetEntityIdValue);
    this.validateType(typeValue);
    this.validateDescription(descriptionValue);
    this.recipientIdsValue = this.normalizeRecipients(
      visibilityValue,
      recipientIdsValue,
    );
  }

  static create(props: CreateRelationshipProps): Relationship {
    return new Relationship(
      RelationshipId.create(),
      props.campaignId,
      props.sourceEntityId,
      props.targetEntityId,
      props.type,
      props.description ?? null,
      props.visibility ?? RelationshipVisibility.PUBLIC,
      props.recipientIds ?? [],
      props.concealedEndpoint ?? null,
      new Date(),
      new Date(),
      null,
    );
  }

  static rehydrate(props: RehydrateRelationshipProps): Relationship {
    return new Relationship(
      props.id,
      props.campaignId,
      props.sourceEntityId,
      props.targetEntityId,
      props.type,
      props.description,
      props.visibility,
      props.recipientIds,
      props.concealedEndpoint,
      props.createdAt,
      props.updatedAt,
      props.deletedAt,
    );
  }

  get Id(): RelationshipId {
    return this.idValue;
  }

  get CampaignId(): string {
    return this.campaignIdValue;
  }

  get SourceEntityId(): string {
    return this.sourceEntityIdValue;
  }

  get TargetEntityId(): string {
    return this.targetEntityIdValue;
  }

  get Type(): string {
    return this.typeValue;
  }

  get Description(): string | null {
    return this.descriptionValue;
  }

  get Visibility(): RelationshipVisibility {
    return this.visibilityValue;
  }

  get RecipientIds(): UserId[] {
    return [...this.recipientIdsValue];
  }

  get ConcealedEndpoint(): RelationshipEndpoint | null {
    return this.concealedEndpointValue;
  }

  get CreatedAt(): Date {
    return this.createdAtValue;
  }

  get UpdatedAt(): Date {
    return this.updatedAtValue;
  }

  get DeletedAt(): Date | null {
    return this.deletedAtValue;
  }

  changeType(type: string): void {
    this.validateType(type);

    this.typeValue = type;
    this.updatedAtValue = new Date();
  }

  changeDescription(description: string | null): void {
    this.validateDescription(description);

    this.descriptionValue = description;
    this.updatedAtValue = new Date();
  }

  changeVisibility(
    visibility: RelationshipVisibility,
    recipientIds: UserId[] = [],
  ): void {
    this.recipientIdsValue = this.normalizeRecipients(visibility, recipientIds);
    this.visibilityValue = visibility;
    this.updatedAtValue = new Date();
  }

  // `null` reveals both endpoints again — the reveal mechanic is just
  // setting this back to null, not repointing source/target.
  changeConcealedEndpoint(endpoint: RelationshipEndpoint | null): void {
    this.concealedEndpointValue = endpoint;
    this.updatedAtValue = new Date();
  }

  delete(): void {
    if (this.deletedAtValue !== null) {
      return;
    }

    this.deletedAtValue = new Date();
    this.updatedAtValue = this.deletedAtValue;
  }

  restore(): void {
    this.deletedAtValue = null;
    this.updatedAtValue = new Date();
  }

  isDeleted(): boolean {
    return this.deletedAtValue !== null;
  }

  private validateNoSelfRelationship(
    sourceEntityId: string,
    targetEntityId: string,
  ): void {
    if (sourceEntityId === targetEntityId) {
      throw new ValidationError(
        "Relationship source and target cannot be the same entity.",
      );
    }
  }

  private validateType(type: string): void {
    const trimmed = type.trim();

    if (!trimmed) {
      throw new ValidationError("Relationship type is required.");
    }

    if (trimmed.length > 100) {
      throw new ValidationError("Relationship type is too long.");
    }
  }

  // Mirrors Note.normalizeRecipients: recipients are meaningless outside
  // TARGETED, and a TARGETED relationship nobody can see is a mistake, not
  // a stricter secret.
  private normalizeRecipients(
    visibility: RelationshipVisibility,
    recipientIds: UserId[],
  ): UserId[] {
    const deduped = [
      ...new Map(recipientIds.map((id) => [id.toString(), id])).values(),
    ];

    if (visibility === RelationshipVisibility.TARGETED) {
      if (deduped.length === 0) {
        throw new ValidationError(
          "A targeted relationship needs at least one recipient.",
        );
      }

      return deduped;
    }

    return [];
  }

  private validateDescription(description: string | null): void {
    if (description === null) {
      return;
    }

    if (description.length > 1000) {
      throw new ValidationError(
        "Relationship description cannot exceed 1000 characters.",
      );
    }
  }
}
