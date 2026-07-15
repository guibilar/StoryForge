import { NoteLink } from "./NoteLink";

export interface NoteLinkRepository {
  findByNote(noteId: string): Promise<NoteLink[]>;

  findByTargetEntity(entityId: string): Promise<NoteLink[]>;

  findByTargetNote(noteId: string): Promise<NoteLink[]>;

  replaceForNote(noteId: string, links: NoteLink[]): Promise<void>;
}
