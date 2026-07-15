import { Note } from "./Note";
import { NoteId } from "./NoteId";

export interface NoteRepository {
  findById(id: NoteId): Promise<Note | null>;

  findByCampaign(campaignId: string): Promise<Note[]>;

  create(note: Note): Promise<void>;

  update(note: Note): Promise<void>;
}
