import type { Note as DomainNote } from "@storyforge/domain";
import type { GraphQLContext } from "../../../../graphql/context";

export const Note = {
  linkedEntities: (note: DomainNote, _args: unknown, context: GraphQLContext) =>
    context.noteService.listLinkedEntities(note.Id.toString()),

  linkedNotes: (note: DomainNote, _args: unknown, context: GraphQLContext) =>
    context.noteService.listLinkedNotes(note.Id.toString()),

  backlinks: (note: DomainNote, _args: unknown, context: GraphQLContext) =>
    context.noteService.listNoteBacklinks(note.Id.toString()),
};
