import { CampaignMember } from "../campaignMember";
import { Entity, EntityId } from "../entity";
import { ValidationError } from "../shared";
import { UserId } from "../user";
import { CampaignId } from "./CampaignId";

export interface CreateCampaignProps {
  name: string;
  description?: string | null;
}

export interface RehydrateCampaignProps {
  id: CampaignId;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
  campaignMembers: CampaignMember[];
  entities: Entity[];
}

export class Campaign {
  private constructor(
    private readonly idValue: CampaignId,
    private nameValue: string,
    private descriptionValue: string | null,
    private readonly createdAtValue: Date,
    private updatedAtValue: Date,
    private archivedAtValue: Date | null,
    private readonly campaignMembersValue: CampaignMember[],
    private readonly entitiesValue: Entity[],
  ) {
    this.validateName(nameValue);
    this.validateDescription(descriptionValue);
  }

  static create(props: CreateCampaignProps): Campaign {
    return new Campaign(
      CampaignId.create(),
      props.name,
      props.description ?? null,
      new Date(),
      new Date(),
      null,
      [],
      [],
    );
  }

  static rehydrate(props: RehydrateCampaignProps): Campaign {
    return new Campaign(
      props.id,
      props.name,
      props.description,
      props.createdAt,
      props.updatedAt,
      props.archivedAt,
      props.campaignMembers,
      props.entities,
    );
  }

  get Id(): CampaignId {
    return this.idValue;
  }

  get Name(): string {
    return this.nameValue;
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

  get ArchivedAt(): Date | null {
    return this.archivedAtValue;
  }

  rename(name: string): void {
    const trimmed = name.trim();

    this.validateName(name);

    this.nameValue = trimmed;
    this.updatedAtValue = new Date();
  }

  changeDescription(description: string | null): void {
    this.validateDescription(description);

    this.descriptionValue = description;
    this.updatedAtValue = new Date();
  }

  archive(): void {
    if (this.archivedAtValue) {
      throw new ValidationError("Campaign is already archived.");
    }

    this.archivedAtValue = new Date();
  }

  private validateName(name: string): void {
    const trimmed = name.trim();

    if (!trimmed) {
      throw new ValidationError("Campaign name cannot be empty.");
    }

    if (trimmed.length > 255) {
      throw new ValidationError("Campaign name cannot exceed 255 characters.");
    }
  }

  private validateDescription(description: string | null): void {
    if (description === null) {
      return;
    }

    if (description.length > 1000) {
      throw new ValidationError(
        "Campaign description cannot exceed 1000 characters.",
      );
    }
  }

  addMember(member: CampaignMember): void {
    const existingMember = this.campaignMembersValue.find((m) =>
      m.UserId.equals(member.UserId),
    );

    if (existingMember) {
      throw new ValidationError(
        `User with ID ${member.UserId.toString()} is already a member of the campaign.`,
      );
    }

    this.campaignMembersValue.push(member);
  }

  removeMember(userId: UserId): void {
    const index = this.campaignMembersValue.findIndex((m) =>
      m.UserId.equals(userId),
    );

    if (index === -1) {
      throw new ValidationError(
        `User with ID ${userId.toString()} is not a member of the campaign.`,
      );
    }

    this.campaignMembersValue.splice(index, 1);
  }

  get Members(): CampaignMember[] {
    return [...this.campaignMembersValue];
  }

  addEntity(entity: Entity): void {
    const existingEntity = this.entitiesValue.find((e) =>
      e.Id.equals(entity.Id),
    );

    if (existingEntity) {
      throw new ValidationError(
        `Entity with ID ${entity.Id.toString()} already exists in the campaign.`,
      );
    }

    this.entitiesValue.push(entity);
  }

  removeEntity(entityId: EntityId): void {
    const index = this.entitiesValue.findIndex((e) => e.Id.equals(entityId));

    if (index === -1) {
      throw new ValidationError(
        `Entity with ID ${entityId.toString()} does not exist in the campaign.`,
      );
    }

    this.entitiesValue.splice(index, 1);
  }

  get Entities(): Entity[] {
    return [...this.entitiesValue];
  }
}
