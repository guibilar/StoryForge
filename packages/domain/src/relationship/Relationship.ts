import { ValidationError } from "../shared";
import { RelationshipId } from "./RelationshipId";
import { RelationshipType } from "./RelationshipType";

export interface CreateRelationshipProps {
  campaignId: string;
  sourceEntityId: string;
  targetEntityId: string;
  type: RelationshipType;
  description?: string | null;
}

export interface RehydrateRelationshipProps {
  id: RelationshipId;
  campaignId: string;
  sourceEntityId: string;
  targetEntityId: string;
  type: RelationshipType;
  description: string | null;
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
    private typeValue: RelationshipType,
    private descriptionValue: string | null,
    private readonly createdAtValue: Date,
    private updatedAtValue: Date,
    private deletedAtValue: Date | null,
  ) {
    this.validateNoSelfRelationship(sourceEntityIdValue, targetEntityIdValue);
    this.validateType(typeValue);
    this.validateDescription(descriptionValue);
  }

  static create(props: CreateRelationshipProps): Relationship {
    return new Relationship(
      RelationshipId.create(),
      props.campaignId,
      props.sourceEntityId,
      props.targetEntityId,
      props.type,
      props.description ?? null,
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

  get Type(): RelationshipType {
    return this.typeValue;
  }

  get Description(): string | null {
    return this.descriptionValue;
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

  changeType(type: RelationshipType): void {
    this.validateType(type);

    this.typeValue = type;
    this.updatedAtValue = new Date();
  }

  changeDescription(description: string | null): void {
    this.validateDescription(description);

    this.descriptionValue = description;
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

  private validateType(type: RelationshipType): void {
    if (!Object.values(RelationshipType).includes(type)) {
      throw new ValidationError(`Invalid relationship type: "${type}".`);
    }
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
