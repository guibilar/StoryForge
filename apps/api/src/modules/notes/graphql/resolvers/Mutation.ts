import type { GraphQLContext } from "../../../../graphql/context";
import { toGraphQLError } from "../../../../graphql/errors";
import { requireCurrentUser } from "../../../auth/graphql/guards";
import { requireCampaignMember } from "../../../campaignMembers/graphql/guards";
import type { UpdateNoteDto } from "../../application/NoteService";

export const Mutation = {
  createNote: async (
    _parent: unknown,
    args: {
      input: {
        campaignId: string;
        title: string;
        content?: string;
        parentNoteId?: string;
      };
    },
    context: GraphQLContext,
  ) => {
    try {
      const membership = await requireCampaignMember(
        context,
        args.input.campaignId,
      );
      return await context.noteService.createNote({
        ...args.input,
        authorId: membership.UserId.toString(),
      });
    } catch (error) {
      toGraphQLError(error);
    }
  },

  updateNote: async (
    _parent: unknown,
    args: { input: UpdateNoteDto },
    context: GraphQLContext,
  ) => {
    try {
      requireCurrentUser(context);
      const note = await context.noteService.getNote(args.input.id);
      await requireCampaignMember(context, note.CampaignId);
      return await context.noteService.updateNote(args.input);
    } catch (error) {
      toGraphQLError(error);
    }
  },

  deleteNote: async (
    _parent: unknown,
    args: { id: string },
    context: GraphQLContext,
  ) => {
    try {
      requireCurrentUser(context);
      const note = await context.noteService.getNote(args.id);
      await requireCampaignMember(context, note.CampaignId);
      await context.noteService.deleteNote(args.id);
      return true;
    } catch (error) {
      toGraphQLError(error);
    }
  },

  moveNote: async (
    _parent: unknown,
    args: { id: string; parentNoteId?: string | null },
    context: GraphQLContext,
  ) => {
    try {
      requireCurrentUser(context);
      const note = await context.noteService.getNote(args.id);
      await requireCampaignMember(context, note.CampaignId);
      return await context.noteService.moveNote(
        args.id,
        args.parentNoteId ?? null,
      );
    } catch (error) {
      toGraphQLError(error);
    }
  },
};
