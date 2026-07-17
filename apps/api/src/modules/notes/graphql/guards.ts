import {
  CampaignMember,
  canViewNote,
  filterNotesByVisibility,
  ForbiddenError,
  Note,
} from "@storyforge/domain";
import type { GraphQLContext } from "../../../graphql/context";
import {
  requireCampaignMember,
  requireCampaignWriter,
} from "../../campaignMembers/graphql/guards";

export async function requireNoteViewer(
  context: GraphQLContext,
  note: Note,
): Promise<CampaignMember> {
  const membership = await requireCampaignMember(context, note.CampaignId);

  if (!canViewNote(note, membership.UserId, membership.Role)) {
    throw new ForbiddenError("You cannot view this note.");
  }

  return membership;
}

/**
 * Mutating a note requires write access to the campaign AND the ability to
 * see the note — a co-Storyteller must not edit another author's targeted
 * handout they were never shown.
 */
export async function requireNoteWriter(
  context: GraphQLContext,
  note: Note,
): Promise<CampaignMember> {
  const membership = await requireCampaignWriter(context, note.CampaignId);

  if (!canViewNote(note, membership.UserId, membership.Role)) {
    throw new ForbiddenError("You cannot view this note.");
  }

  return membership;
}

export async function filterViewableNotes(
  context: GraphQLContext,
  campaignId: string,
  notes: Note[],
): Promise<Note[]> {
  const membership = await requireCampaignMember(context, campaignId);

  return filterNotesByVisibility(notes, membership.UserId, membership.Role);
}
