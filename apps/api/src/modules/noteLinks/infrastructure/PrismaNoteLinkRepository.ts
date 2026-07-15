import { NoteLink, NoteLinkRepository } from "@storyforge/domain";

import { prisma } from "@storyforge/database";
import { NoteLinkMapper } from "./NoteLinkMapper";

export class PrismaNoteLinkRepository implements NoteLinkRepository {
  async findByNote(noteId: string): Promise<NoteLink[]> {
    const records = await prisma.noteLink.findMany({
      where: { noteId },
    });

    return records.map(NoteLinkMapper.toDomain);
  }

  async findByTargetEntity(entityId: string): Promise<NoteLink[]> {
    const records = await prisma.noteLink.findMany({
      where: { targetEntityId: entityId },
    });

    return records.map(NoteLinkMapper.toDomain);
  }

  async findByTargetNote(noteId: string): Promise<NoteLink[]> {
    const records = await prisma.noteLink.findMany({
      where: { targetNoteId: noteId },
    });

    return records.map(NoteLinkMapper.toDomain);
  }

  async replaceForNote(noteId: string, links: NoteLink[]): Promise<void> {
    await prisma.$transaction([
      prisma.noteLink.deleteMany({ where: { noteId } }),
      ...links.map((link) =>
        prisma.noteLink.create({ data: NoteLinkMapper.toPersistence(link) }),
      ),
    ]);
  }
}
