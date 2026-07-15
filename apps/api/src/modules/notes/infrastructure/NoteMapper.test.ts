import { describe, expect, it } from "vitest";
import { Note, UserId } from "@storyforge/domain";
import type { Note as PrismaNote } from "@storyforge/database";
import { NoteMapper } from "./NoteMapper";

describe("NoteMapper", () => {
  it("maps a persistence record to a domain note", () => {
    const record: PrismaNote = {
      id: "11111111-1111-1111-1111-111111111111",
      campaignId: "22222222-2222-2222-2222-222222222222",
      authorId: "33333333-3333-3333-3333-333333333333",
      title: "Session 1 prep",
      content: "# Notes\n\nSome markdown.",
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
    expect(note.CreatedAt).toEqual(record.createdAt);
    expect(note.UpdatedAt).toEqual(record.updatedAt);
    expect(note.DeletedAt).toBeNull();
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
      createdAt: note.CreatedAt,
      updatedAt: note.UpdatedAt,
      deletedAt: note.DeletedAt,
    });
  });
});
