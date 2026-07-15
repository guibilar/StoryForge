import type { Note as DomainNote } from "@storyforge/domain";
import type { GraphQLContext } from "../../../../graphql/context";

export const Note = {
  id: (note: DomainNote) => note.Id.toString(),
  campaignId: (note: DomainNote) => note.CampaignId,
  authorId: (note: DomainNote) => note.AuthorId.toString(),
  title: (note: DomainNote) => note.Title,
  content: (note: DomainNote) => note.Content,
  parentNoteId: (note: DomainNote) => note.ParentNoteId?.toString() ?? null,
  parent: (note: DomainNote, _args: unknown, context: GraphQLContext) =>
    context.noteService.getParent(note),
  children: (note: DomainNote, _args: unknown, context: GraphQLContext) =>
    context.noteService.listChildren(note.Id.toString()),
  createdAt: (note: DomainNote) => note.CreatedAt.toISOString(),
  updatedAt: (note: DomainNote) => note.UpdatedAt.toISOString(),
  deletedAt: (note: DomainNote) => note.DeletedAt?.toISOString() ?? null,
};
