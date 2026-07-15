import { Note, NoteId, UserId } from "@storyforge/domain";
import type { Note as PrismaNote } from "@storyforge/database";

export class NoteMapper {
  static toDomain(record: PrismaNote): Note {
    return Note.rehydrate({
      id: NoteId.fromString(record.id),
      campaignId: record.campaignId,
      authorId: UserId.fromString(record.authorId),
      title: record.title,
      content: record.content,
      parentNoteId: record.parentNoteId
        ? NoteId.fromString(record.parentNoteId)
        : null,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      deletedAt: record.deletedAt,
    });
  }

  static toPersistence(note: Note) {
    return {
      id: note.Id.toString(),
      campaignId: note.CampaignId,
      authorId: note.AuthorId.toString(),
      title: note.Title,
      content: note.Content,
      parentNoteId: note.ParentNoteId?.toString() ?? null,
      createdAt: note.CreatedAt,
      updatedAt: note.UpdatedAt,
      deletedAt: note.DeletedAt,
    };
  }
}
