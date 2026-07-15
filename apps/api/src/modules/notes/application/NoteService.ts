import {
  Note,
  NoteId,
  NoteRepository,
  NotFoundError,
  UserId,
} from "@storyforge/domain";

export interface CreateNoteDto {
  campaignId: string;
  authorId: string;
  title: string;
  content?: string;
}

export interface UpdateNoteDto {
  id: string;
  title?: string;
  content?: string;
}

export class NoteService {
  constructor(private readonly repository: NoteRepository) {}

  async createNote(dto: CreateNoteDto): Promise<Note> {
    const note = Note.create({
      campaignId: dto.campaignId,
      authorId: UserId.fromString(dto.authorId),
      title: dto.title,
      content: dto.content,
    });

    await this.repository.create(note);

    return note;
  }

  async updateNote(dto: UpdateNoteDto): Promise<Note> {
    const note = await this.repository.findById(NoteId.fromString(dto.id));

    if (!note) {
      throw new NotFoundError("Note not found.");
    }

    if (dto.title !== undefined) {
      note.changeTitle(dto.title);
    }

    if (dto.content !== undefined) {
      note.changeContent(dto.content);
    }

    await this.repository.update(note);

    return note;
  }

  async deleteNote(id: string): Promise<void> {
    const note = await this.repository.findById(NoteId.fromString(id));

    if (!note) {
      throw new NotFoundError("Note not found.");
    }

    note.delete();

    await this.repository.update(note);
  }

  async getNote(id: string): Promise<Note> {
    const note = await this.repository.findById(NoteId.fromString(id));

    if (!note) {
      throw new NotFoundError("Note not found.");
    }

    return note;
  }

  async listNotes(campaignId: string): Promise<Note[]> {
    return this.repository.findByCampaign(campaignId);
  }
}
