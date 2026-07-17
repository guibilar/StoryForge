import { describe, expect, it } from "vitest";
import { canViewNote, filterNotesByVisibility } from "./NoteAccess";
import { Note, NoteVisibility } from "../note";
import { UserId } from "../user";
import type { CampaignRole } from "../campaignMember";

const author = UserId.create();
const recipient = UserId.create();
const outsider = UserId.create();

function makeNote(visibility: NoteVisibility): Note {
  return Note.create({
    campaignId: "campaign-1",
    authorId: author,
    title: `${visibility} note`,
    visibility,
    recipientIds: visibility === NoteVisibility.TARGETED ? [recipient] : [],
  });
}

describe("canViewNote", () => {
  it.each([
    NoteVisibility.SHARED,
    NoteVisibility.PRIVATE,
    NoteVisibility.TARGETED,
  ])("the author can always view their %s note", (visibility) => {
    expect(canViewNote(makeNote(visibility), author, "PLAYER")).toBe(true);
  });

  it("everyone can view a SHARED note", () => {
    expect(
      canViewNote(makeNote(NoteVisibility.SHARED), outsider, "OBSERVER"),
    ).toBe(true);
  });

  it.each(["OWNER", "STORYTELLER", "CO_STORYTELLER"] satisfies CampaignRole[])(
    "%s can view a PRIVATE note they did not author",
    (role) => {
      expect(
        canViewNote(makeNote(NoteVisibility.PRIVATE), outsider, role),
      ).toBe(true);
    },
  );

  it.each(["PLAYER", "OBSERVER"] satisfies CampaignRole[])(
    "%s cannot view a PRIVATE note they did not author",
    (role) => {
      expect(
        canViewNote(makeNote(NoteVisibility.PRIVATE), outsider, role),
      ).toBe(false);
    },
  );

  it("a named recipient can view a TARGETED note", () => {
    expect(
      canViewNote(makeNote(NoteVisibility.TARGETED), recipient, "PLAYER"),
    ).toBe(true);
  });

  it.each(["OWNER", "STORYTELLER", "PLAYER"] satisfies CampaignRole[])(
    "a %s who is neither author nor recipient cannot view a TARGETED note",
    (role) => {
      expect(
        canViewNote(makeNote(NoteVisibility.TARGETED), outsider, role),
      ).toBe(false);
    },
  );
});

describe("filterNotesByVisibility", () => {
  const notes = [
    makeNote(NoteVisibility.SHARED),
    makeNote(NoteVisibility.PRIVATE),
    makeNote(NoteVisibility.TARGETED),
  ];

  it("keeps everything for the author", () => {
    expect(filterNotesByVisibility(notes, author, "STORYTELLER")).toHaveLength(
      3,
    );
  });

  it("keeps SHARED and TARGETED for a recipient player", () => {
    const visible = filterNotesByVisibility(notes, recipient, "PLAYER");

    expect(visible.map((note) => note.Visibility)).toEqual([
      NoteVisibility.SHARED,
      NoteVisibility.TARGETED,
    ]);
  });

  it("keeps only SHARED for an unrelated player", () => {
    const visible = filterNotesByVisibility(notes, outsider, "PLAYER");

    expect(visible.map((note) => note.Visibility)).toEqual([
      NoteVisibility.SHARED,
    ]);
  });
});
