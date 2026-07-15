import { Note, NoteId, NoteRepository } from "@storyforge/domain";

import { prisma } from "@storyforge/database";
import { NoteMapper } from "./NoteMapper";

export class PrismaNoteRepository implements NoteRepository {
  async findById(id: NoteId): Promise<Note | null> {
    const record = await prisma.note.findUnique({
      where: {
        id: id.toString(),
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
}
