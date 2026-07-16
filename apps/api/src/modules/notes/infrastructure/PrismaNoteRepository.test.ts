import { afterEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { Note, NoteId, UserId } from "@storyforge/domain";
import { prisma } from "@storyforge/database";
import { PrismaNoteRepository } from "./PrismaNoteRepository";

const repository = new PrismaNoteRepository();
const createdCampaignIds: string[] = [];
const createdUserIds: string[] = [];

function uniqueTitle(): string {
  return `test-note-${randomUUID()}`;
}

async function createCampaign(): Promise<string> {
  const campaign = await prisma.campaign.create({
    data: { id: randomUUID(), name: `test-campaign-${randomUUID()}` },
  });
  createdCampaignIds.push(campaign.id);
  return campaign.id;
}

async function createUser(): Promise<string> {
  const user = await prisma.user.create({
    data: {
      id: randomUUID(),
      email: `test-${randomUUID()}@example.com`,
      password: "hashed",
    },
  });
  createdUserIds.push(user.id);
  return user.id;
}

afterEach(async () => {
  if (createdCampaignIds.length > 0) {
    await prisma.campaign.deleteMany({
      where: { id: { in: createdCampaignIds } },
    });
    createdCampaignIds.length = 0;
  }
  if (createdUserIds.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    createdUserIds.length = 0;
  }
});

describe("PrismaNoteRepository", () => {
  it("creates a note and finds it by id", async () => {
    const campaignId = await createCampaign();
    const authorId = await createUser();
    const note = Note.create({
      campaignId,
      authorId: UserId.fromString(authorId),
      title: uniqueTitle(),
      content: "Some content",
    });

    await repository.create(note);
    const found = await repository.findById(note.Id);

    expect(found).not.toBeNull();
    expect(found?.Id.equals(note.Id)).toBe(true);
    expect(found?.CampaignId).toBe(campaignId);
    expect(found?.AuthorId.toString()).toBe(authorId);
    expect(found?.Content).toBe("Some content");
  });

  it("returns null when the note does not exist", async () => {
    const found = await repository.findById(NoteId.create());

    expect(found).toBeNull();
  });

  it("returns null for a soft-deleted note", async () => {
    const campaignId = await createCampaign();
    const authorId = await createUser();
    const note = Note.create({
      campaignId,
      authorId: UserId.fromString(authorId),
      title: uniqueTitle(),
    });
    await repository.create(note);
    note.delete();
    await repository.update(note);

    const found = await repository.findById(note.Id);

    expect(found).toBeNull();
  });

  it("lists notes for a campaign, excluding soft-deleted ones", async () => {
    const campaignId = await createCampaign();
    const authorId = await createUser();
    const kept = Note.create({
      campaignId,
      authorId: UserId.fromString(authorId),
      title: uniqueTitle(),
    });
    const deleted = Note.create({
      campaignId,
      authorId: UserId.fromString(authorId),
      title: uniqueTitle(),
    });
    deleted.delete();
    await repository.create(kept);
    await repository.create(deleted);

    const notes = await repository.findByCampaign(campaignId);

    expect(notes.some((n) => n.Id.equals(kept.Id))).toBe(true);
    expect(notes.some((n) => n.Id.equals(deleted.Id))).toBe(false);
  });

  it("updates a note", async () => {
    const campaignId = await createCampaign();
    const authorId = await createUser();
    const note = Note.create({
      campaignId,
      authorId: UserId.fromString(authorId),
      title: uniqueTitle(),
    });
    await repository.create(note);

    note.changeTitle(uniqueTitle());
    note.changeContent("New content");
    await repository.update(note);

    const found = await repository.findById(note.Id);
    expect(found?.Title).toBe(note.Title);
    expect(found?.Content).toBe("New content");
  });
});
