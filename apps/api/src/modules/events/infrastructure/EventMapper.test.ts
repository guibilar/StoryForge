import { describe, expect, it } from "vitest";
import { Event } from "@storyforge/domain";
import type { Event as PrismaEvent } from "@storyforge/database";
import { EventMapper } from "./EventMapper";

describe("EventMapper", () => {
  it("maps a persistence record to a domain event", () => {
    const record: PrismaEvent = {
      id: "11111111-1111-1111-1111-111111111111",
      campaignId: "22222222-2222-2222-2222-222222222222",
      sessionId: "33333333-3333-3333-3333-333333333333",
      title: "Goblin ambush",
      description: "The party was ambushed on the road.",
      occurredAt: "Day 1",
      createdAt: new Date("2024-01-01T00:00:00Z"),
      updatedAt: new Date("2024-02-01T00:00:00Z"),
    };

    const event = EventMapper.toDomain(record);

    expect(event.Id.toString()).toBe(record.id);
    expect(event.CampaignId).toBe(record.campaignId);
    expect(event.SessionId).toBe(record.sessionId);
    expect(event.Title).toBe(record.title);
    expect(event.Description).toBe(record.description);
    expect(event.OccurredAt).toEqual(record.occurredAt);
    expect(event.CreatedAt).toEqual(record.createdAt);
    expect(event.UpdatedAt).toEqual(record.updatedAt);
  });

  it("maps a domain event to a persistence shape", () => {
    const event = Event.create({
      campaignId: "22222222-2222-2222-2222-222222222222",
      sessionId: "33333333-3333-3333-3333-333333333333",
      title: "Goblin ambush",
      description: "The party was ambushed on the road.",
      occurredAt: "Day 1",
    });

    const record = EventMapper.toPersistence(event);

    expect(record).toEqual({
      id: event.Id.toString(),
      campaignId: event.CampaignId,
      sessionId: event.SessionId,
      title: event.Title,
      description: event.Description,
      occurredAt: event.OccurredAt,
      createdAt: event.CreatedAt,
      updatedAt: event.UpdatedAt,
    });
  });
});
