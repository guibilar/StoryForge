import { Note } from "./Note";
import { NoteId } from "./NoteId";
import { NoteLink } from "../noteLink";

export interface NoteRepository {
  findById(id: NoteId): Promise<Note | null>;

  findByCampaign(campaignId: string): Promise<Note[]>;

  findByTitle(campaignId: string, title: string): Promise<Note[]>;

  findChildren(noteId: string): Promise<Note[]>;

  findRoots(campaignId: string): Promise<Note[]>;

  create(note: Note): Promise<void>;

  update(note: Note): Promise<void>;

  /**
   * Persists the note and replaces its outgoing links in one transaction,
   * so a failure partway through can't leave the note saved with stale or
   * missing links.
   */
  createWithLinks(note: Note, links: NoteLink[]): Promise<void>;

  updateWithLinks(note: Note, links: NoteLink[]): Promise<void>;
}
