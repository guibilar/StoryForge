import { ValidationError } from "../shared";
import { UserId } from "../user/UserId";
import { NoteId } from "./NoteId";

const MAX_CONTENT_LENGTH = 100_000;

export interface CreateNoteProps {
  campaignId: string;
  authorId: UserId;
  title: string;
  content?: string;
  parentNoteId?: NoteId | null;
}

export interface RehydrateNoteProps {
  id: NoteId;
  campaignId: string;
  authorId: UserId;
  title: string;
  content: string;
  parentNoteId: NoteId | null;
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
    private parentNoteIdValue: NoteId | null,
    private readonly createdAtValue: Date,
    private updatedAtValue: Date,
    private deletedAtValue: Date | null,
  ) {
    this.validateTitle(titleValue);
    this.titleValue = titleValue.trim();
    this.validateContent(contentValue);
  }

  static create(props: CreateNoteProps): Note {
    return new Note(
      NoteId.create(),
      props.campaignId,
      props.authorId,
      props.title,
      props.content ?? "",
      props.parentNoteId ?? null,
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
      props.parentNoteId,
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

  get ParentNoteId(): NoteId | null {
    return this.parentNoteIdValue;
  }

  /**
   * Sets the immediate parent. Only guards against a note directly
   * parenting itself — cycle and depth-cap checks require walking the
   * ancestor chain via a repository, so those live in NoteService.
   */
  moveTo(parentId: NoteId | null): void {
    if (parentId && parentId.equals(this.idValue)) {
      throw new ValidationError("A note cannot be its own parent.");
    }

    this.parentNoteIdValue = parentId;
    this.updatedAtValue = new Date();
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
