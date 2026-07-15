import { ValidationError } from "../shared";
import { UserId } from "../user/UserId";
import { NoteId } from "./NoteId";

const MAX_CONTENT_LENGTH = 100_000;

export interface CreateNoteProps {
  campaignId: string;
  authorId: UserId;
  title: string;
  content?: string;
}

export interface RehydrateNoteProps {
  id: NoteId;
  campaignId: string;
  authorId: UserId;
  title: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export class Note {
  private constructor(
    private readonly idValue: NoteId,
    private readonly campaignIdValue: string,
    private readonly authorIdValue: UserId,
    private titleValue: string,
    private contentValue: string,
    private readonly createdAtValue: Date,
    private updatedAtValue: Date,
    private deletedAtValue: Date | null,
  ) {
    this.validateTitle(titleValue);
    this.validateContent(contentValue);
  }

  static create(props: CreateNoteProps): Note {
    return new Note(
      NoteId.create(),
      props.campaignId,
      props.authorId,
      props.title,
      props.content ?? "",
      new Date(),
      new Date(),
      null,
    );
  }

  static rehydrate(props: RehydrateNoteProps): Note {
    return new Note(
      props.id,
      props.campaignId,
      props.authorId,
      props.title,
      props.content,
      props.createdAt,
      props.updatedAt,
      props.deletedAt,
    );
  }

  get Id(): NoteId {
    return this.idValue;
  }

  get CampaignId(): string {
    return this.campaignIdValue;
  }

  get AuthorId(): UserId {
    return this.authorIdValue;
  }

  get Title(): string {
    return this.titleValue;
  }

  get Content(): string {
    return this.contentValue;
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

  changeTitle(title: string): void {
    const trimmed = title.trim();

    this.validateTitle(title);

    this.titleValue = trimmed;
    this.updatedAtValue = new Date();
  }

  changeContent(content: string): void {
    this.validateContent(content);

    this.contentValue = content;
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

  private validateTitle(title: string): void {
    const trimmed = title.trim();

    if (!trimmed) {
      throw new ValidationError("Note title cannot be empty.");
    }

    if (trimmed.length > 255) {
      throw new ValidationError("Note title cannot exceed 255 characters.");
    }
  }

  private validateContent(content: string): void {
    if (content.length > MAX_CONTENT_LENGTH) {
      throw new ValidationError(
        `Note content cannot exceed ${MAX_CONTENT_LENGTH} characters.`,
      );
    }
  }
}
