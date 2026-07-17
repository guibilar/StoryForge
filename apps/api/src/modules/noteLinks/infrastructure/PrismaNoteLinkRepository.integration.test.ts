import { afterEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { NoteLink } from "@storyforge/domain";
import { prisma } from "@storyforge/database";
import { PrismaNoteLinkRepository } from "./PrismaNoteLinkRepository";

const repository = new PrismaNoteLinkRepository();
const createdCampaignIds: string[] = [];
const createdUserIds: string[] = [];

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

async function createNote(
  campaignId: string,
  authorId: string,
): Promise<string> {
  const note = await prisma.note.create({
    data: {
      id: randomUUID(),
      campaignId,
      authorId,
      title: `test-note-${randomUUID()}`,
      content: "",
    },
  });
  return note.id;
}

async function createEntity(campaignId: string): Promise<string> {
  const entity = await prisma.entity.create({
    data: {
      id: randomUUID(),
      campaignId,
      type: "npc",
      name: `test-entity-${randomUUID()}`,
    },
  });
  return entity.id;
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

describe("PrismaNoteLinkRepository", () => {
  it("replaces links for a note and finds them by note, target entity, and target note", async () => {
    const campaignId = await createCampaign();
    const authorId = await createUser();
    const noteA = await createNote(campaignId, authorId);
    const noteB = await createNote(campaignId, authorId);
    const entityId = await createEntity(campaignId);

    await repository.replaceForNote(noteA, [
      NoteLink.create({ noteId: noteA, targetEntityId: entityId }),
      NoteLink.create({ noteId: noteA, targetNoteId: noteB }),
    ]);

    expect(await repository.findByNote(noteA)).toHaveLength(2);
    expect(await repository.findByTargetEntity(entityId)).toHaveLength(1);
    expect(await repository.findByTargetNote(noteB)).toHaveLength(1);
  });

  it("deleteByNote removes links where the note is the source or the target", async () => {
    const campaignId = await createCampaign();
    const authorId = await createUser();
    const noteA = await createNote(campaignId, authorId);
    const noteB = await createNote(campaignId, authorId);
    const noteC = await createNote(campaignId, authorId);

    await repository.replaceForNote(noteA, [
      NoteLink.create({ noteId: noteA, targetNoteId: noteB }),
    ]);
    await repository.replaceForNote(noteC, [
      NoteLink.create({ noteId: noteC, targetNoteId: noteA }),
    ]);

    await repository.deleteByNote(noteA);

    expect(await repository.findByNote(noteA)).toEqual([]);
    expect(await repository.findByTargetNote(noteA)).toEqual([]);
  });

  it("deleteByTargetEntity removes links pointing at the given entity", async () => {
    const campaignId = await createCampaign();
    const authorId = await createUser();
    const note = await createNote(campaignId, authorId);
    const entityId = await createEntity(campaignId);

    await repository.replaceForNote(note, [
      NoteLink.create({ noteId: note, targetEntityId: entityId }),
    ]);

    await repository.deleteByTargetEntity(entityId);

    expect(await repository.findByTargetEntity(entityId)).toEqual([]);
  });
});
