import { ValidationError } from "../shared";
import { NoteLinkId } from "./NoteLinkId";

export interface CreateNoteLinkProps {
  noteId: string;
  targetEntityId?: string | null;
  targetNoteId?: string | null;
}

export interface RehydrateNoteLinkProps {
  id: NoteLinkId;
  noteId: string;
  targetEntityId: string | null;
  targetNoteId: string | null;
  createdAt: Date;
}

export class NoteLink {
  private constructor(
    private readonly idValue: NoteLinkId,
    private readonly noteIdValue: string,
    private readonly targetEntityIdValue: string | null,
    private readonly targetNoteIdValue: string | null,
    private readonly createdAtValue: Date,
  ) {
    this.validateExactlyOneTarget(targetEntityIdValue, targetNoteIdValue);
  }

  static create(props: CreateNoteLinkProps): NoteLink {
    return new NoteLink(
      NoteLinkId.create(),
      props.noteId,
      props.targetEntityId ?? null,
      props.targetNoteId ?? null,
      new Date(),
    );
  }

  static rehydrate(props: RehydrateNoteLinkProps): NoteLink {
    return new NoteLink(
      props.id,
      props.noteId,
      props.targetEntityId,
      props.targetNoteId,
      props.createdAt,
    );
  }

  get Id(): NoteLinkId {
    return this.idValue;
  }

  get NoteId(): string {
    return this.noteIdValue;
  }

  get TargetEntityId(): string | null {
    return this.targetEntityIdValue;
  }

  get TargetNoteId(): string | null {
    return this.targetNoteIdValue;
  }

  get CreatedAt(): Date {
    return this.createdAtValue;
  }

  private validateExactlyOneTarget(
    targetEntityId: string | null,
    targetNoteId: string | null,
  ): void {
    const targetCount = [targetEntityId, targetNoteId].filter(
      (value) => value !== null,
    ).length;

    if (targetCount !== 1) {
      throw new ValidationError(
        "A NoteLink must target exactly one entity or note.",
      );
    }
  }
}
