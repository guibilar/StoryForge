import { describe, expect, it } from "vitest";
import { Note } from "./Note";
import { NoteId } from "./NoteId";
import { UserId } from "../user/UserId";

const validProps = {
  campaignId: "campaign-1",
  authorId: UserId.create(),
  title: "Session 1 prep",
  content: "# Notes\n\nSome **markdown** content.",
};

describe("Note", () => {
  it("creates a note with the given props", () => {
    const note = Note.create(validProps);

    expect(note.CampaignId).toBe(validProps.campaignId);
    expect(note.AuthorId.equals(validProps.authorId)).toBe(true);
    expect(note.Title).toBe(validProps.title);
    expect(note.Content).toBe(validProps.content);
    expect(note.DeletedAt).toBeNull();
    expect(note.isDeleted()).toBe(false);
  });

  it("trims the title on create, matching changeTitle's behavior", () => {
    const note = Note.create({ ...validProps, title: "  Padded Title  " });

    expect(note.Title).toBe("Padded Title");
  });

  it("defaults content to an empty string when omitted", () => {
    const note = Note.create({
      campaignId: "campaign-1",
      authorId: UserId.create(),
      title: "Blank note",
    });

    expect(note.Content).toBe("");
  });

  it("rehydrates preserving id and timestamps", () => {
    const id = NoteId.create();
    const createdAt = new Date("2024-01-01T00:00:00Z");
    const updatedAt = new Date("2024-02-01T00:00:00Z");

    const note = Note.rehydrate({
      id,
      campaignId: validProps.campaignId,
      authorId: validProps.authorId,
      title: validProps.title,
      content: validProps.content,
      parentNoteId: null,
      createdAt,
      updatedAt,
      deletedAt: null,
    });

    expect(note.Id.equals(id)).toBe(true);
    expect(note.CreatedAt).toBe(createdAt);
    expect(note.UpdatedAt).toBe(updatedAt);
  });

  it.each(["", "   "])("rejects an empty title %j", (title) => {
    expect(() => Note.create({ ...validProps, title })).toThrow(
      "Note title cannot be empty.",
    );
  });

  it("rejects a title longer than 255 characters", () => {
    expect(() =>
      Note.create({ ...validProps, title: "a".repeat(256) }),
    ).toThrow("Note title cannot exceed 255 characters.");
  });

  it("rejects content longer than 100000 characters", () => {
    expect(() =>
      Note.create({ ...validProps, content: "a".repeat(100_001) }),
    ).toThrow("Note content cannot exceed 100000 characters.");
  });

  it("trims the title on changeTitle", () => {
    const note = Note.create(validProps);

    note.changeTitle("  New Title  ");

    expect(note.Title).toBe("New Title");
  });

  it("changes content", () => {
    const note = Note.create(validProps);

    note.changeContent("Updated content");

    expect(note.Content).toBe("Updated content");
  });

  it("soft-deletes and restores", () => {
    const note = Note.create(validProps);

    note.delete();
    expect(note.isDeleted()).toBe(true);
    expect(note.DeletedAt).toBeInstanceOf(Date);

    note.restore();
    expect(note.isDeleted()).toBe(false);
    expect(note.DeletedAt).toBeNull();
  });

  it("deleting twice keeps the original deletedAt", () => {
    const note = Note.create(validProps);

    note.delete();
    const firstDeletedAt = note.DeletedAt;
    note.delete();

    expect(note.DeletedAt).toBe(firstDeletedAt);
  });

  it("creates with a parent note id", () => {
    const parentId = NoteId.create();
    const note = Note.create({ ...validProps, parentNoteId: parentId });

    expect(note.ParentNoteId?.equals(parentId)).toBe(true);
  });

  it("defaults parentNoteId to null when omitted", () => {
    const note = Note.create(validProps);

    expect(note.ParentNoteId).toBeNull();
  });

  describe("moveTo", () => {
    it("sets the parent note id", () => {
      const note = Note.create(validProps);
      const parentId = NoteId.create();

      note.moveTo(parentId);

      expect(note.ParentNoteId?.equals(parentId)).toBe(true);
    });

    it("clears the parent when moved to null", () => {
      const note = Note.create({
        ...validProps,
        parentNoteId: NoteId.create(),
      });

      note.moveTo(null);

      expect(note.ParentNoteId).toBeNull();
    });

    it("rejects a note becoming its own parent", () => {
      const note = Note.create(validProps);

      expect(() => note.moveTo(note.Id)).toThrow(
        "A note cannot be its own parent.",
      );
    });
  });
});
