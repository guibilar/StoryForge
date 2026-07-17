import { ValidationError } from "../shared";
import { UserId } from "../user/UserId";
import { NoteId } from "./NoteId";
import { NoteVisibility } from "./NoteVisibility";

const MAX_CONTENT_LENGTH = 100_000;

export interface CreateNoteProps {
  campaignId: string;
  authorId: UserId;
  title: string;
  content?: string;
  parentNoteId?: NoteId | null;
  visibility?: NoteVisibility;
  recipientIds?: UserId[];
}

export interface RehydrateNoteProps {
  id: NoteId;
  campaignId: string;
  authorId: UserId;
  title: string;
  content: string;
  parentNoteId: NoteId | null;
  visibility: NoteVisibility;
  recipientIds: UserId[];
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
    private visibilityValue: NoteVisibility,
    private recipientIdsValue: UserId[],
    private readonly createdAtValue: Date,
    private updatedAtValue: Date,
    private deletedAtValue: Date | null,
  ) {
    this.validateTitle(titleValue);
    this.titleValue = titleValue.trim();
    this.validateContent(contentValue);
    this.recipientIdsValue = this.normalizeRecipients(
      visibilityValue,
      recipientIdsValue,
    );
  }

  static create(props: CreateNoteProps): Note {
    return new Note(
      NoteId.create(),
      props.campaignId,
      props.authorId,
      props.title,
      props.content ?? "",
      props.parentNoteId ?? null,
      props.visibility ?? NoteVisibility.SHARED,
      props.recipientIds ?? [],
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
      props.visibility,
      props.recipientIds,
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

  get Visibility(): NoteVisibility {
    return this.visibilityValue;
  }

  get RecipientIds(): UserId[] {
    return [...this.recipientIdsValue];
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

  changeVisibility(
    visibility: NoteVisibility,
    recipientIds: UserId[] = [],
  ): void {
    this.recipientIdsValue = this.normalizeRecipients(visibility, recipientIds);
    this.visibilityValue = visibility;
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

  private normalizeRecipients(
    visibility: NoteVisibility,
    recipientIds: UserId[],
  ): UserId[] {
    const deduped = [
      ...new Map(recipientIds.map((id) => [id.toString(), id])).values(),
    ];

    if (visibility === NoteVisibility.TARGETED) {
      if (deduped.length === 0) {
        throw new ValidationError(
          "A targeted note needs at least one recipient.",
        );
      }

      return deduped;
    }

    if (deduped.length > 0) {
      throw new ValidationError("Only targeted notes can have recipients.");
    }

    return deduped;
  }
}
