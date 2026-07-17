import { ValidationError } from "../shared";
import { TagId } from "./TagId";

export interface CreateTagProps {
  campaignId: string;
  name: string;
}

export interface RehydrateTagProps {
  id: TagId;
  campaignId: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export class Tag {
  private constructor(
    private readonly idValue: TagId,
    private readonly campaignIdValue: string,
    private nameValue: string,
    private readonly createdAtValue: Date,
    private updatedAtValue: Date,
  ) {
    this.nameValue = Tag.normalize(nameValue);
  }

  static create(props: CreateTagProps): Tag {
    return new Tag(
      TagId.create(),
      props.campaignId,
      props.name,
      new Date(),
      new Date(),
    );
  }

  static rehydrate(props: RehydrateTagProps): Tag {
    return new Tag(
      props.id,
      props.campaignId,
      props.name,
      props.createdAt,
      props.updatedAt,
    );
  }

  get Id(): TagId {
    return this.idValue;
  }

  get CampaignId(): string {
    return this.campaignIdValue;
  }

  get Name(): string {
    return this.nameValue;
  }

  get CreatedAt(): Date {
    return this.createdAtValue;
  }

  get UpdatedAt(): Date {
    return this.updatedAtValue;
  }

  rename(name: string): void {
    this.nameValue = Tag.normalize(name);
    this.updatedAtValue = new Date();
  }

  /**
   * Trims and lowercases a tag name the same way Tag storage does, so
   * callers can look up an existing tag by a not-yet-normalized name (e.g.
   * user input) before deciding whether to create a new one.
   */
  static normalize(name: string): string {
    const trimmed = name.trim().toLocaleLowerCase();

    if (!trimmed) {
      throw new ValidationError("Tag name cannot be empty.");
    }

    if (trimmed.length > 255) {
      throw new ValidationError("Tag name cannot exceed 255 characters.");
    }

    return trimmed;
  }
}
