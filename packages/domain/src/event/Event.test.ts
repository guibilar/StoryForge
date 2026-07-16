import { describe, expect, it } from "vitest";
import { Event } from "./Event";
import { EventId } from "./EventId";

const validProps = {
  campaignId: "campaign-1",
  sessionId: "session-1",
  title: "Goblin ambush",
  description: "The party was ambushed on the road.",
  occurredAt: new Date("2024-01-01T00:00:00Z"),
};

describe("Event", () => {
  it("creates an event with defaults", () => {
    const event = Event.create(validProps);

    expect(event.CampaignId).toBe(validProps.campaignId);
    expect(event.SessionId).toBe(validProps.sessionId);
    expect(event.Title).toBe(validProps.title);
    expect(event.Description).toBe(validProps.description);
    expect(event.OccurredAt).toBe(validProps.occurredAt);
  });

  it("defaults sessionId and description to null when omitted", () => {
    const event = Event.create({
      campaignId: "campaign-1",
      title: "Goblin ambush",
      occurredAt: new Date("2024-01-01T00:00:00Z"),
    });

    expect(event.SessionId).toBeNull();
    expect(event.Description).toBeNull();
  });

  it("rehydrates preserving id and timestamps", () => {
    const id = EventId.create();
    const createdAt = new Date("2024-01-01T00:00:00Z");
    const updatedAt = new Date("2024-02-01T00:00:00Z");

    const event = Event.rehydrate({
      id,
      campaignId: validProps.campaignId,
      sessionId: null,
      title: validProps.title,
      description: null,
      occurredAt: validProps.occurredAt,
      createdAt,
      updatedAt,
    });

    expect(event.Id.equals(id)).toBe(true);
    expect(event.CreatedAt).toBe(createdAt);
    expect(event.UpdatedAt).toBe(updatedAt);
  });

  it.each(["", "   "])("rejects an empty title %j", (title) => {
    expect(() => Event.create({ ...validProps, title })).toThrow(
      "Event title cannot be empty.",
    );
  });

  it("rejects a title longer than 255 characters", () => {
    expect(() =>
      Event.create({ ...validProps, title: "a".repeat(256) }),
    ).toThrow("Event title cannot exceed 255 characters.");
  });

  it("rejects a description longer than 1000 characters", () => {
    expect(() =>
      Event.create({ ...validProps, description: "a".repeat(1001) }),
    ).toThrow("Event description cannot exceed 1000 characters.");
  });

  it("changes title, description, occurredAt and session", () => {
    const event = Event.create(validProps);
    const newDate = new Date("2024-03-01T00:00:00Z");

    event.changeTitle("Renamed event");
    event.changeDescription("New description");
    event.changeOccurredAt(newDate);
    event.changeSession("session-2");

    expect(event.Title).toBe("Renamed event");
    expect(event.Description).toBe("New description");
    expect(event.OccurredAt).toBe(newDate);
    expect(event.SessionId).toBe("session-2");
  });

  it("clears the session when changeSession is called with null", () => {
    const event = Event.create(validProps);

    event.changeSession(null);

    expect(event.SessionId).toBeNull();
  });

  it("rejects renaming to an empty title", () => {
    const event = Event.create(validProps);

    expect(() => event.changeTitle("  ")).toThrow(
      "Event title cannot be empty.",
    );
  });
});
