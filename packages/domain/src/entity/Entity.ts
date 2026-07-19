import { ValidationError } from "../shared";
import { EntityCategory, isEntityCategory } from "./EntityCategory";
import { EntityId } from "./EntityId";
import { EntityVisibility } from "./EntityVisibility";

export interface CreateEntityProps {
  campaignId: string;
  type: string;
  category: EntityCategory;
  name: string;
  description?: string | null;
  icon?: string | null;
  image?: string | null;
  visibility: EntityVisibility;
  isPlayerCharacter?: boolean;
  // References a User (a campaign's members are identified by
  // (campaignId, userId), not a synthetic CampaignMember id — see
  // CampaignMemberMapper/the CampaignMember GraphQL resolver, which
  // synthesizes `id` as `${campaignId}:${userId}` for the same reason).
  // Resolving this to the owning CampaignMember is a cross-aggregate
  // question answered by EntityService, mirroring Marker.EntityId.
  ownerUserId?: string | null;
}

export interface RehydrateEntityProps {
  id: EntityId;
  campaignId: string;
  type: string;
  category: EntityCategory;
  name: string;
  description: string | null;
  icon: string | null;
  image: string | null;
  visibility: EntityVisibility;
  isPlayerCharacter: boolean;
  ownerUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export class Entity {
  private constructor(
    private readonly idValue: EntityId,
    private readonly campaignIdValue: string,
    private readonly typeValue: string,
    private categoryValue: EntityCategory,
    private nameValue: string,
    private descriptionValue: string | null,
    private iconValue: string | null,
    private imageValue: string | null,
    private visibilityValue: EntityVisibility,
    private isPlayerCharacterValue: boolean,
    private ownerUserIdValue: string | null,
    private readonly createdAtValue: Date,
    private updatedAtValue: Date,
    private deletedAtValue: Date | null,
  ) {
    this.validateName(nameValue);
    this.validateDescription(descriptionValue);
    this.validateType(typeValue);
    this.validateCategory(categoryValue);
    this.validateIsPlayerCharacter(isPlayerCharacterValue, categoryValue);
    this.validateOwnerUserId(ownerUserIdValue, isPlayerCharacterValue);
  }

  static create(props: CreateEntityProps): Entity {
    return new Entity(
      EntityId.create(),
      props.campaignId,
      props.type,
      props.category,
      props.name,
      props.description ?? null,
      props.icon ?? null,
      props.image ?? null,
      props.visibility,
      props.isPlayerCharacter ?? false,
      props.ownerUserId ?? null,
      new Date(),
      new Date(),
      null,
    );
  }

  static rehydrate(props: RehydrateEntityProps): Entity {
    return new Entity(
      props.id,
      props.campaignId,
      props.type,
      props.category,
      props.name,
      props.description,
      props.icon,
      props.image,
      props.visibility,
      props.isPlayerCharacter,
      props.ownerUserId,
      props.createdAt,
      props.updatedAt,
      props.deletedAt,
    );
  }

  get Id(): EntityId {
    return this.idValue;
  }

  get CampaignId(): string {
    return this.campaignIdValue;
  }

  get Type(): string {
    return this.typeValue;
  }

  get Category(): EntityCategory {
    return this.categoryValue;
  }

  get Name(): string {
    return this.nameValue;
  }

  get Description(): string | null {
    return this.descriptionValue;
  }

  get Icon(): string | null {
    return this.iconValue;
  }

  get Image(): string | null {
    return this.imageValue;
  }

  get Visibility(): EntityVisibility {
    return this.visibilityValue;
  }

  get IsPlayerCharacter(): boolean {
    return this.isPlayerCharacterValue;
  }

  get OwnerUserId(): string | null {
    return this.ownerUserIdValue;
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

  changeVisibility(visibility: EntityVisibility): void {
    this.visibilityValue = visibility;
    this.updatedAtValue = new Date();
  }

  changeCategory(category: EntityCategory): void {
    this.validateCategory(category);
    this.validateIsPlayerCharacter(this.isPlayerCharacterValue, category);

    this.categoryValue = category;
    this.updatedAtValue = new Date();
  }

  changeIsPlayerCharacter(isPlayerCharacter: boolean): void {
    this.validateIsPlayerCharacter(isPlayerCharacter, this.categoryValue);

    this.isPlayerCharacterValue = isPlayerCharacter;
    // A non-PC can't have an owning member — clear it instead of leaving a
    // dangling link that validateOwnerUserId would then reject on the next
    // mutation. Losing PC status is a deliberate demotion, not an error.
    if (!isPlayerCharacter) {
      this.ownerUserIdValue = null;
    }
    this.updatedAtValue = new Date();
  }

  // Cross-aggregate validation (does this user exist and belong to this
  // entity's campaign) is a question for EntityService, mirroring
  // Marker.linkEntity/MarkerService.requireEntityInCampaign — this only
  // enforces the same-aggregate invariant that only a Player Character can
  // have an owner.
  linkOwner(ownerUserId: string | null): void {
    this.validateOwnerUserId(ownerUserId, this.isPlayerCharacterValue);

    this.ownerUserIdValue = ownerUserId;
    this.updatedAtValue = new Date();
  }

  changeIcon(icon: string | null): void {
    this.iconValue = icon;
    this.updatedAtValue = new Date();
  }

  changeImage(image: string | null): void {
    this.imageValue = image;
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

  private validateName(name: string): void {
    const trimmed = name.trim();

    if (!trimmed) {
      throw new ValidationError("Entity name cannot be empty.");
    }

    if (trimmed.length > 255) {
      throw new ValidationError("Entity name cannot exceed 255 characters.");
    }
  }

  private validateDescription(description: string | null): void {
    if (description === null) {
      return;
    }

    if (description.length > 1000) {
      throw new ValidationError(
        "Entity description cannot exceed 1000 characters.",
      );
    }
  }

  private validateType(type: string): void {
    const trimmed = type.trim();

    if (!trimmed) {
      throw new ValidationError("Entity type is required.");
    }

    if (trimmed.length > 100) {
      throw new ValidationError("Entity type is too long.");
    }
  }

  private validateCategory(category: EntityCategory): void {
    if (!isEntityCategory(category)) {
      throw new ValidationError("Entity category is invalid.");
    }
  }

  private validateIsPlayerCharacter(
    isPlayerCharacter: boolean,
    category: EntityCategory,
  ): void {
    if (isPlayerCharacter && category !== EntityCategory.CHARACTER) {
      throw new ValidationError(
        "Only a CHARACTER-category entity can be marked as a Player Character.",
      );
    }
  }

  private validateOwnerUserId(
    ownerUserId: string | null,
    isPlayerCharacter: boolean,
  ): void {
    if (ownerUserId !== null && !isPlayerCharacter) {
      throw new ValidationError(
        "Only a Player Character can have an owning campaign member.",
      );
    }
  }
}
