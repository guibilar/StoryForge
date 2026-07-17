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
