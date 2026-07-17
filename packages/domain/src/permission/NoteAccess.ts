import type { CampaignRole } from "../campaignMember";
import type { Note } from "../note";
import { NoteVisibility } from "../note";
import type { UserId } from "../user";

const STORYTELLER_ROLES = new Set<CampaignRole>([
  "OWNER",
  "STORYTELLER",
  "CO_STORYTELLER",
]);

export function canViewNote(
  note: Note,
  userId: UserId,
  role: CampaignRole,
): boolean {
  if (note.AuthorId.equals(userId)) {
    return true;
  }

  switch (note.Visibility) {
    case NoteVisibility.SHARED:
      return true;
    case NoteVisibility.PRIVATE:
      return STORYTELLER_ROLES.has(role);
    case NoteVisibility.TARGETED:
      return note.RecipientIds.some((recipient) => recipient.equals(userId));
  }
}

export function filterNotesByVisibility(
  notes: Note[],
  userId: UserId,
  role: CampaignRole,
): Note[] {
  return notes.filter((note) => canViewNote(note, userId, role));
}

/**
 * Storyteller-tier roles may edit any note they can view; players only the
 * notes they authored. Observers can never edit (they also cannot create,
 * so the author check can never be true for them).
 */
export function canEditNote(
  note: Note,
  userId: UserId,
  role: CampaignRole,
): boolean {
  if (!canViewNote(note, userId, role)) {
    return false;
  }

  if (STORYTELLER_ROLES.has(role)) {
    return true;
  }

  return role === "PLAYER" && note.AuthorId.equals(userId);
}

/**
 * Players may author SHARED and PRIVATE notes (a PRIVATE player note is a
 * journal the Storyteller side can still read); TARGETED handouts remain a
 * Storyteller-tier tool.
 */
export function canAuthorNoteVisibility(
  role: CampaignRole,
  visibility: NoteVisibility,
): boolean {
  if (STORYTELLER_ROLES.has(role)) {
    return true;
  }

  return role === "PLAYER" && visibility !== NoteVisibility.TARGETED;
}
