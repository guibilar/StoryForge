import { Note, NoteId, NoteVisibility, UserId } from "@storyforge/domain";
import type {
  Note as PrismaNote,
  NoteRecipient as PrismaNoteRecipient,
} from "@storyforge/database";

export type NoteRecord = PrismaNote & { recipients: PrismaNoteRecipient[] };

export class NoteMapper {
  static toDomain(record: NoteRecord): Note {
    return Note.rehydrate({
      id: NoteId.fromString(record.id),
      campaignId: record.campaignId,
      authorId: UserId.fromString(record.authorId),
      title: record.title,
      content: record.content,
      parentNoteId: record.parentNoteId
        ? NoteId.fromString(record.parentNoteId)
        : null,
      visibility: record.visibility as NoteVisibility,
      recipientIds: record.recipients.map((recipient) =>
        UserId.fromString(recipient.userId),
      ),
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
      visibility: note.Visibility,
      createdAt: note.CreatedAt,
      updatedAt: note.UpdatedAt,
      deletedAt: note.DeletedAt,
    };
  }

  static toRecipientCreates(note: Note) {
    return note.RecipientIds.map((userId) => ({ userId: userId.toString() }));
  }
}
