import { canViewNote, type Note as DomainNote } from "@storyforge/domain";
import type { GraphQLContext } from "../../../../graphql/context";
import { requireCampaignMember } from "../../../campaignMembers/graphql/guards";
import { filterViewableNotes } from "../guards";

export const Note = {
  id: (note: DomainNote) => note.Id.toString(),
  campaignId: (note: DomainNote) => note.CampaignId,
  authorId: (note: DomainNote) => note.AuthorId.toString(),
  title: (note: DomainNote) => note.Title,
  content: (note: DomainNote) => note.Content,
  parentNoteId: (note: DomainNote) => note.ParentNoteId?.toString() ?? null,
  parent: async (note: DomainNote, _args: unknown, context: GraphQLContext) => {
    const parent = await context.noteService.getParent(note);

    if (!parent) {
      return null;
    }

    const membership = await requireCampaignMember(context, note.CampaignId);

    return canViewNote(parent, membership.UserId, membership.Role)
      ? parent
      : null;
  },
  children: async (
    note: DomainNote,
    _args: unknown,
    context: GraphQLContext,
  ) => {
    const children = await context.noteService.listChildren(note.Id.toString());

    return filterViewableNotes(context, note.CampaignId, children);
  },
  visibility: (note: DomainNote) => note.Visibility,
  recipientIds: (note: DomainNote) =>
    note.RecipientIds.map((userId) => userId.toString()),
  createdAt: (note: DomainNote) => note.CreatedAt.toISOString(),
  updatedAt: (note: DomainNote) => note.UpdatedAt.toISOString(),
  deletedAt: (note: DomainNote) => note.DeletedAt?.toISOString() ?? null,
};
