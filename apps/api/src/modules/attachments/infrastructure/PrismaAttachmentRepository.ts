import {
  Attachment,
  AttachmentId,
  AttachmentRepository,
} from "@storyforge/domain";

import { prisma } from "@storyforge/database";
import { AttachmentMapper } from "./AttachmentMapper";

export class PrismaAttachmentRepository implements AttachmentRepository {
  async findById(id: AttachmentId): Promise<Attachment | null> {
    const record = await prisma.attachment.findUnique({
      where: {
        id: id.toString(),
      },
    });

    if (!record) {
      return null;
    }

    return AttachmentMapper.toDomain(record);
  }

  async findByNote(noteId: string): Promise<Attachment[]> {
    const records = await prisma.attachment.findMany({
      where: {
        noteId,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    return records.map(AttachmentMapper.toDomain);
  }

  async create(attachment: Attachment): Promise<void> {
    await prisma.attachment.create({
      data: AttachmentMapper.toPersistence(attachment),
    });
  }

  async delete(id: AttachmentId): Promise<void> {
    await prisma.attachment.delete({
      where: {
        id: id.toString(),
      },
    });
  }
}
