import {
  Entity,
  EntityId,
  EntityRepository,
  Note,
  NoteId,
  NoteLink,
  NoteLinkRepository,
  NoteRepository,
  NotFoundError,
  UserId,
} from "@storyforge/domain";

import { parseNoteLinks } from "./NoteLinkParser";
import { NoteLinkResolver } from "./NoteLinkResolver";

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
  private readonly linkResolver: NoteLinkResolver;

  constructor(
    private readonly repository: NoteRepository,
    private readonly entityRepository: EntityRepository,
    private readonly noteLinkRepository: NoteLinkRepository,
  ) {
    this.linkResolver = new NoteLinkResolver(entityRepository, repository);
  }

  async createNote(dto: CreateNoteDto): Promise<Note> {
    const note = Note.create({
      campaignId: dto.campaignId,
      authorId: UserId.fromString(dto.authorId),
      title: dto.title,
      content: dto.content,
    });

    await this.repository.create(note);
    await this.syncLinks(note);

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
    await this.syncLinks(note);

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

  async listLinkedEntities(noteId: string): Promise<Entity[]> {
    const links = await this.noteLinkRepository.findByNote(noteId);
    const entityIds = links
      .map((link) => link.TargetEntityId)
      .filter((id): id is string => id !== null);

    return this.hydrateEntities(entityIds);
  }

  async listLinkedNotes(noteId: string): Promise<Note[]> {
    const links = await this.noteLinkRepository.findByNote(noteId);
    const noteIds = links
      .map((link) => link.TargetNoteId)
      .filter((id): id is string => id !== null);

    return this.hydrateNotes(noteIds);
  }

  async listNoteBacklinks(noteId: string): Promise<Note[]> {
    const links = await this.noteLinkRepository.findByTargetNote(noteId);

    return this.hydrateNotes(links.map((link) => link.NoteId));
  }

  async listEntityBacklinks(entityId: string): Promise<Note[]> {
    const links = await this.noteLinkRepository.findByTargetEntity(entityId);

    return this.hydrateNotes(links.map((link) => link.NoteId));
  }

  private async syncLinks(note: Note): Promise<void> {
    const parsedLinks = parseNoteLinks(note.Content);
    const resolvedTargets = await this.linkResolver.resolve(
      note.CampaignId,
      parsedLinks,
    );

    const noteId = note.Id.toString();
    const links = resolvedTargets.map((target) =>
      NoteLink.create({ noteId, ...target }),
    );

    await this.noteLinkRepository.replaceForNote(noteId, links);
  }

  private async hydrateEntities(entityIds: string[]): Promise<Entity[]> {
    const entities = await Promise.all(
      entityIds.map((id) =>
        this.entityRepository.findById(EntityId.fromString(id)),
      ),
    );

    return entities.filter((entity): entity is Entity => entity !== null);
  }

  private async hydrateNotes(noteIds: string[]): Promise<Note[]> {
    const notes = await Promise.all(
      noteIds.map((id) => this.repository.findById(NoteId.fromString(id))),
    );

    return notes.filter((note): note is Note => note !== null);
  }
}
