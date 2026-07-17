import {
  CampaignMemberRepository,
  Entity,
  EntityId,
  EntityRepository,
  Note,
  NoteId,
  NoteLink,
  NoteLinkRepository,
  NoteRepository,
  NoteVisibility,
  NotFoundError,
  UserId,
  ValidationError,
} from "@storyforge/domain";

import { parseNoteLinks } from "./NoteLinkParser";
import { NoteLinkResolver } from "./NoteLinkResolver";

const MAX_NOTE_DEPTH = 5;

export interface CreateNoteDto {
  campaignId: string;
  authorId: string;
  title: string;
  content?: string;
  parentNoteId?: string;
  visibility?: NoteVisibility;
  recipientIds?: string[];
}

export interface UpdateNoteDto {
  id: string;
  title?: string;
  content?: string;
  visibility?: NoteVisibility;
  recipientIds?: string[];
}

export class NoteService {
  private readonly linkResolver: NoteLinkResolver;

  constructor(
    private readonly repository: NoteRepository,
    private readonly entityRepository: EntityRepository,
    private readonly noteLinkRepository: NoteLinkRepository,
    private readonly campaignMemberRepository: CampaignMemberRepository,
  ) {
    this.linkResolver = new NoteLinkResolver(entityRepository, repository);
  }

  async createNote(dto: CreateNoteDto): Promise<Note> {
    const parentNoteId = dto.parentNoteId
      ? (await this.resolveParent(dto.campaignId, dto.parentNoteId)).Id
      : null;

    const recipientIds = await this.resolveRecipients(
      dto.campaignId,
      dto.recipientIds ?? [],
    );

    const note = Note.create({
      campaignId: dto.campaignId,
      authorId: UserId.fromString(dto.authorId),
      title: dto.title,
      content: dto.content,
      parentNoteId,
      visibility: dto.visibility,
      recipientIds,
    });

    const links = await this.resolveLinks(note);
    await this.repository.createWithLinks(note, links);

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

    if (dto.visibility !== undefined || dto.recipientIds !== undefined) {
      const visibility = dto.visibility ?? note.Visibility;
      // Recipients not sent: keep them when visibility stays the same, drop
      // them when it changes (a note leaving TARGETED loses its handout list).
      const recipientIds =
        dto.recipientIds !== undefined
          ? await this.resolveRecipients(note.CampaignId, dto.recipientIds)
          : visibility === note.Visibility
            ? note.RecipientIds
            : [];

      note.changeVisibility(visibility, recipientIds);
    }

    const links = await this.resolveLinks(note);
    await this.repository.updateWithLinks(note, links);

    return note;
  }

  async deleteNote(id: string): Promise<void> {
    const note = await this.repository.findById(NoteId.fromString(id));

    if (!note) {
      throw new NotFoundError("Note not found.");
    }

    await this.deleteWithDescendants(note);
  }

  /**
   * Notes are soft-deleted (deletedAt), so the Postgres ON DELETE CASCADE on
   * parentNoteId never fires — it only triggers on a real row DELETE. Cascade
   * the subtree explicitly here instead, matching the product decision that
   * deleting a parent Note takes its descendants down with it.
   */
  private async deleteWithDescendants(note: Note): Promise<void> {
    note.delete();
    await this.repository.update(note);
    await this.noteLinkRepository.deleteByNote(note.Id.toString());

    const children = await this.repository.findChildren(note.Id.toString());

    for (const child of children) {
      await this.deleteWithDescendants(child);
    }
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

  async listChildren(noteId: string): Promise<Note[]> {
    return this.repository.findChildren(noteId);
  }

  async listRoots(campaignId: string): Promise<Note[]> {
    return this.repository.findRoots(campaignId);
  }

  async getParent(note: Note): Promise<Note | null> {
    if (!note.ParentNoteId) {
      return null;
    }

    return this.repository.findById(note.ParentNoteId);
  }

  async moveNote(id: string, parentNoteId: string | null): Promise<Note> {
    const note = await this.repository.findById(NoteId.fromString(id));

    if (!note) {
      throw new NotFoundError("Note not found.");
    }

    if (parentNoteId === null) {
      note.moveTo(null);
    } else {
      const parent = await this.resolveParent(
        note.CampaignId,
        parentNoteId,
        note.Id,
      );
      note.moveTo(parent.Id);
    }

    await this.repository.update(note);

    return note;
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

  /**
   * Handout recipients must belong to the note's campaign — a targeted note
   * addressed to a stranger would silently never be visible to them.
   */
  private async resolveRecipients(
    campaignId: string,
    recipientIds: string[],
  ): Promise<UserId[]> {
    const userIds = recipientIds.map((id) => UserId.fromString(id));

    const memberships = await Promise.all(
      userIds.map((userId) =>
        this.campaignMemberRepository.findByCampaignAndUser(campaignId, userId),
      ),
    );

    if (memberships.some((membership) => membership === null)) {
      throw new ValidationError(
        "All note recipients must be members of the campaign.",
      );
    }

    return userIds;
  }

  /**
   * Parses [[links]] out of the note's content and resolves them against
   * existing entities/notes. Read-only — createNote/updateNote persist the
   * result together with the note itself in one transaction, so a failure
   * here can't leave the note saved with stale or missing links.
   */
  private async resolveLinks(note: Note): Promise<NoteLink[]> {
    const parsedLinks = parseNoteLinks(note.Content);
    const resolvedTargets = await this.linkResolver.resolve(
      note.CampaignId,
      parsedLinks,
    );

    const noteId = note.Id.toString();

    return resolvedTargets.map((target) =>
      NoteLink.create({ noteId, ...target }),
    );
  }

  /**
   * Validates a candidate parent: must exist, must be in the same campaign,
   * must not create a cycle (excludeNoteId appearing among its ancestors),
   * and must not push the moved/created note past MAX_NOTE_DEPTH levels.
   */
  private async resolveParent(
    campaignId: string,
    parentNoteId: string,
    excludeNoteId?: NoteId,
  ): Promise<Note> {
    const parent = await this.repository.findById(
      NoteId.fromString(parentNoteId),
    );

    if (!parent) {
      throw new NotFoundError("Parent note not found.");
    }

    if (parent.CampaignId !== campaignId) {
      throw new ValidationError("Parent note must be in the same campaign.");
    }

    let ancestor: Note | null = parent;
    let depth = 1;

    while (ancestor) {
      if (excludeNoteId && ancestor.Id.equals(excludeNoteId)) {
        throw new ValidationError("Moving this note would create a cycle.");
      }

      if (depth >= MAX_NOTE_DEPTH) {
        throw new ValidationError(
          `Notes cannot be nested more than ${MAX_NOTE_DEPTH} levels deep.`,
        );
      }

      if (!ancestor.ParentNoteId) {
        break;
      }

      ancestor = await this.repository.findById(ancestor.ParentNoteId);
      depth++;
    }

    return parent;
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
