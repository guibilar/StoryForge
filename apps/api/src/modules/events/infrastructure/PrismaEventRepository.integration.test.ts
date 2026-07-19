import { afterEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import {
  Entity,
  EntityCategory,
  EntityVisibility,
  Event,
  EventId,
  Session,
} from "@storyforge/domain";
import { prisma } from "@storyforge/database";
import { PrismaEntityRepository } from "../../entities/infrastructure/PrismaEntityRepository";
import { PrismaSessionRepository } from "../../sessions/infrastructure/PrismaSessionRepository";
import { PrismaEventRepository } from "./PrismaEventRepository";

const repository = new PrismaEventRepository();
const entityRepository = new PrismaEntityRepository();
const sessionRepository = new PrismaSessionRepository();
const createdCampaignIds: string[] = [];

function uniqueName(prefix: string): string {
  return `${prefix}-${randomUUID()}`;
}

async function createCampaign(): Promise<string> {
  const campaign = await prisma.campaign.create({
    data: { id: randomUUID(), name: uniqueName("test-campaign") },
  });
  createdCampaignIds.push(campaign.id);
  return campaign.id;
}

async function createEntity(campaignId: string): Promise<Entity> {
  const entity = Entity.create({
    campaignId,
    type: "npc",
    category: EntityCategory.CHARACTER,
    name: uniqueName("test-entity"),
    visibility: EntityVisibility.PUBLIC,
  });
  await entityRepository.create(entity);
  return entity;
}

async function createSession(campaignId: string): Promise<Session> {
  const session = Session.create({
    campaignId,
    sessionNumber: 1,
    date: new Date("2024-01-01T00:00:00Z"),
  });
  await sessionRepository.create(session);
  return session;
}

afterEach(async () => {
  if (createdCampaignIds.length > 0) {
    await prisma.campaign.deleteMany({
      where: { id: { in: createdCampaignIds } },
    });
    createdCampaignIds.length = 0;
  }
});

describe("PrismaEventRepository", () => {
  it("creates an event and finds it by id", async () => {
    const campaignId = await createCampaign();
    const event = Event.create({
      campaignId,
      title: uniqueName("event"),
      occurredAt: "Day 1",
    });

    await repository.create(event);
    const found = await repository.findById(event.Id);

    expect(found).not.toBeNull();
    expect(found?.Id.equals(event.Id)).toBe(true);
    expect(found?.CampaignId).toBe(campaignId);
    expect(found?.SessionId).toBeNull();
  });

  it("returns null when the event does not exist", async () => {
    const found = await repository.findById(EventId.create());

    expect(found).toBeNull();
  });

  it("lists events for a campaign ordered by occurredAt", async () => {
    const campaignId = await createCampaign();
    const later = Event.create({
      campaignId,
      title: uniqueName("event"),
      occurredAt: "Day 2",
    });
    const earlier = Event.create({
      campaignId,
      title: uniqueName("event"),
      occurredAt: "Day 1",
    });
    await repository.create(later);
    await repository.create(earlier);

    const events = await repository.findByCampaign(campaignId);

    expect(events.map((e) => e.Id.toString())).toEqual([
      earlier.Id.toString(),
      later.Id.toString(),
    ]);
  });

  it("lists events for a session", async () => {
    const campaignId = await createCampaign();
    const session = await createSession(campaignId);
    const linked = Event.create({
      campaignId,
      sessionId: session.Id.toString(),
      title: uniqueName("event"),
      occurredAt: "Day 1",
    });
    const unlinked = Event.create({
      campaignId,
      title: uniqueName("event"),
      occurredAt: "Day 1",
    });
    await repository.create(linked);
    await repository.create(unlinked);

    const events = await repository.findBySession(session.Id.toString());

    expect(events.map((e) => e.Id.toString())).toEqual([linked.Id.toString()]);
  });

  it("updates an event", async () => {
    const campaignId = await createCampaign();
    const event = Event.create({
      campaignId,
      title: uniqueName("event"),
      occurredAt: "Day 1",
    });
    await repository.create(event);

    event.changeTitle("Updated title");
    await repository.update(event);

    const found = await repository.findById(event.Id);
    expect(found?.Title).toBe("Updated title");
  });

  it("deletes an event", async () => {
    const campaignId = await createCampaign();
    const event = Event.create({
      campaignId,
      title: uniqueName("event"),
      occurredAt: "Day 1",
    });
    await repository.create(event);

    await repository.delete(event.Id);

    const found = await repository.findById(event.Id);
    expect(found).toBeNull();
  });

  it("sets sessionId to null when the linked session is deleted", async () => {
    const campaignId = await createCampaign();
    const session = await createSession(campaignId);
    const event = Event.create({
      campaignId,
      sessionId: session.Id.toString(),
      title: uniqueName("event"),
      occurredAt: "Day 1",
    });
    await repository.create(event);

    await sessionRepository.delete(session.Id);

    const found = await repository.findById(event.Id);
    expect(found?.SessionId).toBeNull();
  });

  it("attaches and detaches a participant idempotently", async () => {
    const campaignId = await createCampaign();
    const entity = await createEntity(campaignId);
    const event = Event.create({
      campaignId,
      title: uniqueName("event"),
      occurredAt: "Day 1",
    });
    await repository.create(event);

    await repository.attachParticipant(
      event.Id,
      entity.Id.toString(),
      "witness",
    );
    await repository.attachParticipant(
      event.Id,
      entity.Id.toString(),
      "witness",
    ); // idempotent

    const participants = await repository.findParticipants(event.Id);
    expect(participants.filter((e) => e.Id.equals(entity.Id))).toHaveLength(1);

    await repository.detachParticipant(event.Id, entity.Id.toString());
    await repository.detachParticipant(event.Id, entity.Id.toString()); // idempotent, no error

    const afterDetach = await repository.findParticipants(event.Id);
    expect(afterDetach.some((e) => e.Id.equals(entity.Id))).toBe(false);
  });

  it("updates the role when a participant is re-attached with a different role", async () => {
    const campaignId = await createCampaign();
    const entity = await createEntity(campaignId);
    const event = Event.create({
      campaignId,
      title: uniqueName("event"),
      occurredAt: "Day 1",
    });
    await repository.create(event);

    await repository.attachParticipant(
      event.Id,
      entity.Id.toString(),
      "witness",
    );
    await repository.attachParticipant(
      event.Id,
      entity.Id.toString(),
      "victim",
    );

    const record = await prisma.eventParticipant.findUnique({
      where: {
        eventId_entityId: {
          eventId: event.Id.toString(),
          entityId: entity.Id.toString(),
        },
      },
    });
    expect(record?.role).toBe("victim");
  });
});
