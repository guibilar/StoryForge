import {
  CampaignMember,
  canAuthorNoteVisibility,
  canEditNote,
  canViewNote,
  filterNotesByVisibility,
  ForbiddenError,
  Note,
  NoteVisibility,
} from "@storyforge/domain";
import type { GraphQLContext } from "../../../graphql/context";
import {
  requireCampaignMember,
  requireCampaignRole,
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
 * Mutating a note requires being able to see it AND edit rights on it:
 * Storyteller-tier roles may edit any note they can view, players only the
 * notes they authored (KAN-90), and a co-Storyteller must not edit another
 * author's targeted handout they were never shown.
 */
export async function requireNoteWriter(
  context: GraphQLContext,
  note: Note,
): Promise<CampaignMember> {
  const membership = await requireNoteViewer(context, note);

  if (!canEditNote(note, membership.UserId, membership.Role)) {
    throw new ForbiddenError("You can only edit notes you authored.");
  }

  return membership;
}

export async function requireNoteCreator(
  context: GraphQLContext,
  campaignId: string,
): Promise<CampaignMember> {
  return requireCampaignRole(context, campaignId, "CREATE_NOTE");
}

/**
 * Rejects visibility levels the member's role cannot author — players may
 * write SHARED/PRIVATE notes but not TARGETED handouts. Applied on create
 * and on any update that touches visibility or recipients.
 */
export function requireAuthorableVisibility(
  membership: CampaignMember,
  visibility: NoteVisibility,
): void {
  if (!canAuthorNoteVisibility(membership.Role, visibility)) {
    throw new ForbiddenError("Your role cannot create targeted handouts.");
  }
}

/**
 * A member may only file a note under a parent they can view — otherwise a
 * player could probe for (or attach notes to) hidden Storyteller notes by id.
 */
export async function requireViewableParent(
  context: GraphQLContext,
  parentNoteId: string,
): Promise<void> {
  const parent = await context.noteService.getNote(parentNoteId);
  await requireNoteViewer(context, parent);
}

export async function filterViewableNotes(
  context: GraphQLContext,
  campaignId: string,
  notes: Note[],
): Promise<Note[]> {
  const membership = await requireCampaignMember(context, campaignId);

  return filterNotesByVisibility(notes, membership.UserId, membership.Role);
}
