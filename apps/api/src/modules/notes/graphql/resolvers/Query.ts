import type { GraphQLContext } from "../../../../graphql/context";
import { toGraphQLError } from "../../../../graphql/errors";
import { requireCurrentUser } from "../../../auth/graphql/guards";
import { requireCampaignMember } from "../../../campaignMembers/graphql/guards";

export const Query = {
  note: async (
    _parent: unknown,
    args: { id: string },
    context: GraphQLContext,
  ) => {
    try {
      requireCurrentUser(context);
      const note = await context.noteService.getNote(args.id);
      await requireCampaignMember(context, note.CampaignId);
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
      await requireCampaignMember(context, args.campaignId);
      return await context.noteService.listNotes(args.campaignId);
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
      await requireCampaignMember(context, args.campaignId);
      return await context.noteService.listRoots(args.campaignId);
    } catch (error) {
      toGraphQLError(error);
    }
  },
};
