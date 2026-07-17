import { Note, NoteId, NoteLink, NoteRepository } from "@storyforge/domain";

import { prisma } from "@storyforge/database";
import { NoteMapper } from "./NoteMapper";
import { NoteLinkMapper } from "../../noteLinks/infrastructure/NoteLinkMapper";

export class PrismaNoteRepository implements NoteRepository {
  async findById(id: NoteId): Promise<Note | null> {
    const record = await prisma.note.findFirst({
      where: {
        id: id.toString(),
        deletedAt: null,
      },
    });

    if (!record) {
      return null;
    }

    return NoteMapper.toDomain(record);
  }

  async findByCampaign(campaignId: string): Promise<Note[]> {
    const records = await prisma.note.findMany({
      where: {
        campaignId,
        deletedAt: null,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    return records.map(NoteMapper.toDomain);
  }

  async findByTitle(campaignId: string, title: string): Promise<Note[]> {
    const records = await prisma.note.findMany({
      where: {
        campaignId,
        title,
        deletedAt: null,
      },
    });

    return records.map(NoteMapper.toDomain);
  }

  async findChildren(noteId: string): Promise<Note[]> {
    const records = await prisma.note.findMany({
      where: {
        parentNoteId: noteId,
        deletedAt: null,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    return records.map(NoteMapper.toDomain);
  }

  async findRoots(campaignId: string): Promise<Note[]> {
    const records = await prisma.note.findMany({
      where: {
        campaignId,
        parentNoteId: null,
        deletedAt: null,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    return records.map(NoteMapper.toDomain);
  }

  async create(note: Note): Promise<void> {
    await prisma.note.create({
      data: NoteMapper.toPersistence(note),
    });
  }

  async update(note: Note): Promise<void> {
    await prisma.note.update({
      where: {
        id: note.Id.toString(),
      },
      data: NoteMapper.toPersistence(note),
    });
  }

  async createWithLinks(note: Note, links: NoteLink[]): Promise<void> {
    await prisma.$transaction([
      prisma.note.create({ data: NoteMapper.toPersistence(note) }),
      ...links.map((link) =>
        prisma.noteLink.create({ data: NoteLinkMapper.toPersistence(link) }),
      ),
    ]);
  }

  async updateWithLinks(note: Note, links: NoteLink[]): Promise<void> {
    const noteId = note.Id.toString();

    await prisma.$transaction([
      prisma.note.update({
        where: { id: noteId },
        data: NoteMapper.toPersistence(note),
      }),
      prisma.noteLink.deleteMany({ where: { noteId } }),
      ...links.map((link) =>
        prisma.noteLink.create({ data: NoteLinkMapper.toPersistence(link) }),
      ),
    ]);
  }
}
