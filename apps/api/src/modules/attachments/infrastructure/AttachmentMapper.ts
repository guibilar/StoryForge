import { Attachment, AttachmentId } from "@storyforge/domain";
import type { Attachment as PrismaAttachment } from "@storyforge/database";

export class AttachmentMapper {
  static toDomain(record: PrismaAttachment): Attachment {
    return Attachment.rehydrate({
      id: AttachmentId.fromString(record.id),
      noteId: record.noteId,
      url: record.url,
      fileName: record.fileName,
      mimeType: record.mimeType,
      sizeBytes: record.sizeBytes,
      createdAt: record.createdAt,
    });
  }

  static toPersistence(attachment: Attachment) {
    return {
      id: attachment.Id.toString(),
      noteId: attachment.NoteId,
      url: attachment.Url,
      fileName: attachment.FileName,
      mimeType: attachment.MimeType,
      sizeBytes: attachment.SizeBytes,
      createdAt: attachment.CreatedAt,
    };
  }
}
