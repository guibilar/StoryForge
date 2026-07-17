import { describe, expect, it } from "vitest";
import { Note, NoteVisibility, UserId } from "@storyforge/domain";
import { NoteMapper, type NoteRecord } from "./NoteMapper";

describe("NoteMapper", () => {
  it("maps a persistence record to a domain note", () => {
    const record: NoteRecord = {
      id: "11111111-1111-1111-1111-111111111111",
      campaignId: "22222222-2222-2222-2222-222222222222",
      authorId: "33333333-3333-3333-3333-333333333333",
      title: "Session 1 prep",
      content: "# Notes\n\nSome markdown.",
      parentNoteId: null,
      visibility: "SHARED",
      recipients: [],
      createdAt: new Date("2024-01-01T00:00:00Z"),
      updatedAt: new Date("2024-02-01T00:00:00Z"),
      deletedAt: null,
    };

    const note = NoteMapper.toDomain(record);

    expect(note.Id.toString()).toBe(record.id);
    expect(note.CampaignId).toBe(record.campaignId);
    expect(note.AuthorId.toString()).toBe(record.authorId);
    expect(note.Title).toBe(record.title);
    expect(note.Content).toBe(record.content);
    expect(note.ParentNoteId).toBeNull();
    expect(note.Visibility).toBe(NoteVisibility.SHARED);
    expect(note.RecipientIds).toEqual([]);
    expect(note.CreatedAt).toEqual(record.createdAt);
    expect(note.UpdatedAt).toEqual(record.updatedAt);
    expect(note.DeletedAt).toBeNull();
  });

  it("maps a parentNoteId when present", () => {
    const record: NoteRecord = {
      id: "11111111-1111-1111-1111-111111111111",
      campaignId: "22222222-2222-2222-2222-222222222222",
      authorId: "33333333-3333-3333-3333-333333333333",
      title: "Scene 1",
      content: "Some markdown.",
      parentNoteId: "44444444-4444-4444-4444-444444444444",
      visibility: "SHARED",
      recipients: [],
      createdAt: new Date("2024-01-01T00:00:00Z"),
      updatedAt: new Date("2024-02-01T00:00:00Z"),
      deletedAt: null,
    };

    const note = NoteMapper.toDomain(record);

    expect(note.ParentNoteId?.toString()).toBe(record.parentNoteId);
  });

  it("maps a TARGETED record's recipients", () => {
    const record: NoteRecord = {
      id: "11111111-1111-1111-1111-111111111111",
      campaignId: "22222222-2222-2222-2222-222222222222",
      authorId: "33333333-3333-3333-3333-333333333333",
      title: "Handout",
      content: "For your eyes only.",
      parentNoteId: null,
      visibility: "TARGETED",
      recipients: [
        {
          id: "55555555-5555-5555-5555-555555555555",
          noteId: "11111111-1111-1111-1111-111111111111",
          userId: "66666666-6666-6666-6666-666666666666",
          createdAt: new Date("2024-01-01T00:00:00Z"),
        },
      ],
      createdAt: new Date("2024-01-01T00:00:00Z"),
      updatedAt: new Date("2024-02-01T00:00:00Z"),
      deletedAt: null,
    };

    const note = NoteMapper.toDomain(record);

    expect(note.Visibility).toBe(NoteVisibility.TARGETED);
    expect(note.RecipientIds.map((id) => id.toString())).toEqual([
      "66666666-6666-6666-6666-666666666666",
    ]);
  });

  it("maps a domain note to a persistence shape", () => {
    const note = Note.create({
      campaignId: "22222222-2222-2222-2222-222222222222",
      authorId: UserId.fromString("33333333-3333-3333-3333-333333333333"),
      title: "Session 1 prep",
      content: "Some markdown.",
    });

    const record = NoteMapper.toPersistence(note);

    expect(record).toEqual({
      id: note.Id.toString(),
      campaignId: note.CampaignId,
      authorId: note.AuthorId.toString(),
      title: note.Title,
      content: note.Content,
      parentNoteId: null,
      visibility: NoteVisibility.SHARED,
      createdAt: note.CreatedAt,
      updatedAt: note.UpdatedAt,
      deletedAt: note.DeletedAt,
    });
  });

  it("maps recipients to create inputs", () => {
    const recipient = UserId.create();
    const note = Note.create({
      campaignId: "22222222-2222-2222-2222-222222222222",
      authorId: UserId.create(),
      title: "Handout",
      visibility: NoteVisibility.TARGETED,
      recipientIds: [recipient],
    });

    expect(NoteMapper.toRecipientCreates(note)).toEqual([
      { userId: recipient.toString() },
    ]);
  });
});
