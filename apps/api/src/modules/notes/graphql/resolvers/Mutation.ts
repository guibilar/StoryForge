import { NoteVisibility } from "@storyforge/domain";
import type { GraphQLContext } from "../../../../graphql/context";
import { toGraphQLError } from "../../../../graphql/errors";
import { requireCurrentUser } from "../../../auth/graphql/guards";
import type { UpdateNoteDto } from "../../application/NoteService";
import {
  requireAuthorableVisibility,
  requireNoteCreator,
  requireNoteWriter,
  requireViewableParent,
} from "../guards";

export const Mutation = {
  createNote: async (
    _parent: unknown,
    args: {
      input: {
        campaignId: string;
        title: string;
        content?: string;
        parentNoteId?: string;
        visibility?: NoteVisibility;
        recipientIds?: string[];
      };
    },
    context: GraphQLContext,
  ) => {
    try {
      const membership = await requireNoteCreator(
        context,
        args.input.campaignId,
      );
      requireAuthorableVisibility(
        membership,
        args.input.visibility ?? NoteVisibility.SHARED,
      );
      if (args.input.parentNoteId) {
        await requireViewableParent(context, args.input.parentNoteId);
      }
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
      const membership = await requireNoteWriter(context, note);
      if (
        args.input.visibility !== undefined ||
        args.input.recipientIds !== undefined
      ) {
        requireAuthorableVisibility(
          membership,
          args.input.visibility ?? note.Visibility,
        );
      }
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
      await requireNoteWriter(context, note);
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
      await requireNoteWriter(context, note);
      if (args.parentNoteId) {
        await requireViewableParent(context, args.parentNoteId);
      }
      return await context.noteService.moveNote(
        args.id,
        args.parentNoteId ?? null,
      );
    } catch (error) {
      toGraphQLError(error);
    }
  },
};
