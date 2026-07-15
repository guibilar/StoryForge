import { NoteLink, NoteLinkId } from "@storyforge/domain";
import type { NoteLink as PrismaNoteLink } from "@storyforge/database";

export class NoteLinkMapper {
  static toDomain(record: PrismaNoteLink): NoteLink {
    return NoteLink.rehydrate({
      id: NoteLinkId.fromString(record.id),
      noteId: record.noteId,
      targetEntityId: record.targetEntityId,
      targetNoteId: record.targetNoteId,
      createdAt: record.createdAt,
    });
  }

  static toPersistence(link: NoteLink) {
    return {
      id: link.Id.toString(),
      noteId: link.NoteId,
      targetEntityId: link.TargetEntityId,
      targetNoteId: link.TargetNoteId,
      createdAt: link.CreatedAt,
    };
  }
}
