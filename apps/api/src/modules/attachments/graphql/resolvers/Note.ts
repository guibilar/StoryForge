import type { Note as DomainNote } from "@storyforge/domain";
import type { GraphQLContext } from "../../../../graphql/context";

export const Note = {
  attachments: (note: DomainNote, _args: unknown, context: GraphQLContext) =>
    context.attachmentService.listByNote(note.Id.toString()),
};
