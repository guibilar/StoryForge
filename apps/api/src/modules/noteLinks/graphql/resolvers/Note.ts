import {
  filterByVisibility,
  type Note as DomainNote,
} from "@storyforge/domain";
import type { GraphQLContext } from "../../../../graphql/context";
import { requireCampaignMember } from "../../../campaignMembers/graphql/guards";
import { filterViewableNotes } from "../../../notes/graphql/guards";

export const Note = {
  linkedEntities: async (
    note: DomainNote,
    _args: unknown,
    context: GraphQLContext,
  ) => {
    const entities = await context.noteService.listLinkedEntities(
      note.Id.toString(),
    );
    const membership = await requireCampaignMember(context, note.CampaignId);

    return filterByVisibility(entities, membership.Role);
  },

  linkedNotes: async (
    note: DomainNote,
    _args: unknown,
    context: GraphQLContext,
  ) => {
    const notes = await context.noteService.listLinkedNotes(note.Id.toString());

    return filterViewableNotes(context, note.CampaignId, notes);
  },

  backlinks: async (
    note: DomainNote,
    _args: unknown,
    context: GraphQLContext,
  ) => {
    const notes = await context.noteService.listNoteBacklinks(
      note.Id.toString(),
    );

    return filterViewableNotes(context, note.CampaignId, notes);
  },
};
