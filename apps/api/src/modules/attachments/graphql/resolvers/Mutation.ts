import type { GraphQLContext } from "../../../../graphql/context";
import { toGraphQLError } from "../../../../graphql/errors";
import { requireCurrentUser } from "../../../auth/graphql/guards";
import { requireCampaignMember } from "../../../campaignMembers/graphql/guards";

export const Mutation = {
  uploadNoteAttachment: async (
    _parent: unknown,
    args: { noteId: string; file: File },
    context: GraphQLContext,
  ) => {
    try {
      requireCurrentUser(context);
      const note = await context.noteService.getNote(args.noteId);
      await requireCampaignMember(context, note.CampaignId);
      const url = await context.imageStorage.save(args.noteId, args.file);

      return await context.attachmentService.createAttachment({
        noteId: args.noteId,
        url,
        fileName: args.file.name,
        mimeType: args.file.type,
        sizeBytes: args.file.size,
      });
    } catch (error) {
      toGraphQLError(error);
    }
  },

  deleteAttachment: async (
    _parent: unknown,
    args: { id: string },
    context: GraphQLContext,
  ) => {
    try {
      requireCurrentUser(context);
      const attachment = await context.attachmentService.getAttachment(args.id);
      const note = await context.noteService.getNote(attachment.NoteId);
      await requireCampaignMember(context, note.CampaignId);
      await context.attachmentService.deleteAttachment(args.id);
      return true;
    } catch (error) {
      toGraphQLError(error);
    }
  },
};
