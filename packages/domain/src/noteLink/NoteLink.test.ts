import { describe, expect, it } from "vitest";
import { NoteLink } from "./NoteLink";
import { NoteLinkId } from "./NoteLinkId";
import { ValidationError } from "../shared";

describe("NoteLink", () => {
  it("creates a link targeting an entity", () => {
    const link = NoteLink.create({
      noteId: "note-1",
      targetEntityId: "entity-1",
    });

    expect(link.NoteId).toBe("note-1");
    expect(link.TargetEntityId).toBe("entity-1");
    expect(link.TargetNoteId).toBeNull();
  });

  it("creates a link targeting a note", () => {
    const link = NoteLink.create({
      noteId: "note-1",
      targetNoteId: "note-2",
    });

    expect(link.TargetNoteId).toBe("note-2");
    expect(link.TargetEntityId).toBeNull();
  });

  it("rejects a link with no target", () => {
    expect(() => NoteLink.create({ noteId: "note-1" })).toThrow(
      ValidationError,
    );
  });

  it("rejects a link targeting both an entity and a note", () => {
    expect(() =>
      NoteLink.create({
        noteId: "note-1",
        targetEntityId: "entity-1",
        targetNoteId: "note-2",
      }),
    ).toThrow(ValidationError);
  });

  it("rehydrates preserving id and timestamps", () => {
    const id = NoteLinkId.create();
    const createdAt = new Date("2024-01-01T00:00:00Z");

    const link = NoteLink.rehydrate({
      id,
      noteId: "note-1",
      targetEntityId: "entity-1",
      targetNoteId: null,
      createdAt,
    });

    expect(link.Id).toBe(id);
    expect(link.CreatedAt).toBe(createdAt);
  });
});
