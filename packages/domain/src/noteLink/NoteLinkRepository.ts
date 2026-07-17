import { NoteLink } from "./NoteLink";

export interface NoteLinkRepository {
  findByNote(noteId: string): Promise<NoteLink[]>;

  findByTargetEntity(entityId: string): Promise<NoteLink[]>;

  findByTargetNote(noteId: string): Promise<NoteLink[]>;

  replaceForNote(noteId: string, links: NoteLink[]): Promise<void>;

  /** Removes every NoteLink where noteId is the source or targetNoteId is the target. */
  deleteByNote(noteId: string): Promise<void>;

  /** Removes every NoteLink that targets the given entity. */
  deleteByTargetEntity(entityId: string): Promise<void>;
}
