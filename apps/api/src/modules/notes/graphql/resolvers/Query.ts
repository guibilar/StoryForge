import { filterNotesByVisibility } from "@storyforge/domain";
import type { GraphQLContext } from "../../../../graphql/context";
import { toGraphQLError } from "../../../../graphql/errors";
import { requireCurrentUser } from "../../../auth/graphql/guards";
import { requireCampaignMember } from "../../../campaignMembers/graphql/guards";
import { requireNoteViewer } from "../guards";

export const Query = {
  note: async (
    _parent: unknown,
    args: { id: string },
    context: GraphQLContext,
  ) => {
    try {
      requireCurrentUser(context);
      const note = await context.noteService.getNote(args.id);
      await requireNoteViewer(context, note);
      return note;
    } catch (error) {
      toGraphQLError(error);
    }
  },

  notes: async (
    _parent: unknown,
    args: { campaignId: string },
    context: GraphQLContext,
  ) => {
    try {
      const membership = await requireCampaignMember(context, args.campaignId);
      const notes = await context.noteService.listNotes(args.campaignId);
      return filterNotesByVisibility(notes, membership.UserId, membership.Role);
    } catch (error) {
      toGraphQLError(error);
    }
  },

  noteRoots: async (
    _parent: unknown,
    args: { campaignId: string },
    context: GraphQLContext,
  ) => {
    try {
      const membership = await requireCampaignMember(context, args.campaignId);
      const notes = await context.noteService.listRoots(args.campaignId);
      return filterNotesByVisibility(notes, membership.UserId, membership.Role);
    } catch (error) {
      toGraphQLError(error);
    }
  },
};
