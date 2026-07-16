import { describe, expect, it, vi } from "vitest";
import { CampaignMember, Event, User } from "@storyforge/domain";
import { Mutation } from "./Mutation";
import type { GraphQLContext } from "../../../../graphql/context";
import type { EventService } from "../../application/EventService";
import type { CampaignMemberService } from "../../../campaignMembers/application/CampaignMemberService";

function makeEventService(): EventService {
  return {
    createEvent: vi.fn(),
    updateEvent: vi.fn(),
    deleteEvent: vi.fn(),
    getEvent: vi.fn(),
    listEvents: vi.fn(),
    listEventsBySession: vi.fn(),
    attachParticipant: vi.fn(),
    detachParticipant: vi.fn(),
    listParticipants: vi.fn(),
  } as unknown as EventService;
}

function makeCampaignMemberService(): CampaignMemberService {
  return { getMembership: vi.fn() } as unknown as CampaignMemberService;
}

function makeContext(
  eventService: EventService,
  campaignMemberService: CampaignMemberService,
  currentUser: User | null,
): GraphQLContext {
  return {
    eventService,
    campaignMemberService,
    currentUser,
  } as GraphQLContext;
}

const loggedOutUser = null;
const authenticatedUser = User.create({
  email: "user@example.com",
  password: "hashed",
});

const membership = CampaignMember.create({
  campaignId: "campaign-1",
  userId: authenticatedUser.Id,
  role: "PLAYER",
});

function makeEvent(): Event {
  return Event.create({
    campaignId: "campaign-1",
    title: "Goblin ambush",
    occurredAt: new Date("2024-01-01T00:00:00Z"),
  });
}

describe("events Mutation.createEvent", () => {
  it("rejects with UNAUTHENTICATED when logged out", async () => {
    const eventService = makeEventService();
    const campaignMemberService = makeCampaignMemberService();
    const context = makeContext(
      eventService,
      campaignMemberService,
      loggedOutUser,
    );
    const input = {
      campaignId: "campaign-1",
      title: "Goblin ambush",
      occurredAt: "2024-01-01T00:00:00Z",
    };

    await expect(
      Mutation.createEvent(undefined, { input }, context),
    ).rejects.toMatchObject({
      extensions: { code: "UNAUTHENTICATED" },
    });
    expect(eventService.createEvent).not.toHaveBeenCalled();
  });

  it("rejects with FORBIDDEN when not a campaign member", async () => {
    const eventService = makeEventService();
    const campaignMemberService = makeCampaignMemberService();
    vi.mocked(campaignMemberService.getMembership).mockResolvedValue(null);
    const context = makeContext(
      eventService,
      campaignMemberService,
      authenticatedUser,
    );
    const input = {
      campaignId: "campaign-1",
      title: "Goblin ambush",
      occurredAt: "2024-01-01T00:00:00Z",
    };

    await expect(
      Mutation.createEvent(undefined, { input }, context),
    ).rejects.toMatchObject({ extensions: { code: "FORBIDDEN" } });
    expect(eventService.createEvent).not.toHaveBeenCalled();
  });

  it("delegates to eventService when the user is a campaign member", async () => {
    const eventService = makeEventService();
    const campaignMemberService = makeCampaignMemberService();
    vi.mocked(campaignMemberService.getMembership).mockResolvedValue(
      membership,
    );
    const event = makeEvent();
    vi.mocked(eventService.createEvent).mockResolvedValue(event);
    const context = makeContext(
      eventService,
      campaignMemberService,
      authenticatedUser,
    );
    const input = {
      campaignId: "campaign-1",
      sessionId: "session-1",
      title: "Goblin ambush",
      description: "The party was ambushed on the road.",
      occurredAt: "2024-01-01T00:00:00.000Z",
    };

    const result = await Mutation.createEvent(undefined, { input }, context);

    expect(eventService.createEvent).toHaveBeenCalledWith({
      campaignId: "campaign-1",
      sessionId: "session-1",
      title: "Goblin ambush",
      description: "The party was ambushed on the road.",
      occurredAt: new Date("2024-01-01T00:00:00.000Z"),
    });
    expect(result).toBe(event);
  });
});

describe("events Mutation.updateEvent", () => {
  it("rejects with UNAUTHENTICATED when logged out", async () => {
    const eventService = makeEventService();
    const campaignMemberService = makeCampaignMemberService();
    const context = makeContext(
      eventService,
      campaignMemberService,
      loggedOutUser,
    );
    const input = { id: "event-1", title: "Renamed" };

    await expect(
      Mutation.updateEvent(undefined, { input }, context),
    ).rejects.toMatchObject({
      extensions: { code: "UNAUTHENTICATED" },
    });
    expect(eventService.updateEvent).not.toHaveBeenCalled();
  });

  it("rejects with FORBIDDEN when not a member of the event's campaign", async () => {
    const eventService = makeEventService();
    const campaignMemberService = makeCampaignMemberService();
    const event = makeEvent();
    vi.mocked(eventService.getEvent).mockResolvedValue(event);
    vi.mocked(campaignMemberService.getMembership).mockResolvedValue(null);
    const context = makeContext(
      eventService,
      campaignMemberService,
      authenticatedUser,
    );
    const input = { id: "event-1", title: "Renamed" };

    await expect(
      Mutation.updateEvent(undefined, { input }, context),
    ).rejects.toMatchObject({ extensions: { code: "FORBIDDEN" } });
    expect(eventService.updateEvent).not.toHaveBeenCalled();
  });

  it("delegates to eventService when the user is a campaign member", async () => {
    const eventService = makeEventService();
    const campaignMemberService = makeCampaignMemberService();
    const existing = makeEvent();
    vi.mocked(eventService.getEvent).mockResolvedValue(existing);
    vi.mocked(campaignMemberService.getMembership).mockResolvedValue(
      membership,
    );
    const updated = makeEvent();
    vi.mocked(eventService.updateEvent).mockResolvedValue(updated);
    const context = makeContext(
      eventService,
      campaignMemberService,
      authenticatedUser,
    );
    const input = { id: "event-1", title: "Renamed" };

    const result = await Mutation.updateEvent(undefined, { input }, context);

    expect(eventService.updateEvent).toHaveBeenCalledWith({
      id: "event-1",
      sessionId: undefined,
      title: "Renamed",
      description: undefined,
      occurredAt: undefined,
    });
    expect(result).toBe(updated);
  });
});

describe("events Mutation.deleteEvent", () => {
  it("rejects with UNAUTHENTICATED when logged out", async () => {
    const eventService = makeEventService();
    const campaignMemberService = makeCampaignMemberService();
    const context = makeContext(
      eventService,
      campaignMemberService,
      loggedOutUser,
    );

    await expect(
      Mutation.deleteEvent(undefined, { id: "event-1" }, context),
    ).rejects.toMatchObject({
      extensions: { code: "UNAUTHENTICATED" },
    });
    expect(eventService.deleteEvent).not.toHaveBeenCalled();
  });

  it("rejects with FORBIDDEN when not a member of the event's campaign", async () => {
    const eventService = makeEventService();
    const campaignMemberService = makeCampaignMemberService();
    const event = makeEvent();
    vi.mocked(eventService.getEvent).mockResolvedValue(event);
    vi.mocked(campaignMemberService.getMembership).mockResolvedValue(null);
    const context = makeContext(
      eventService,
      campaignMemberService,
      authenticatedUser,
    );

    await expect(
      Mutation.deleteEvent(undefined, { id: "event-1" }, context),
    ).rejects.toMatchObject({ extensions: { code: "FORBIDDEN" } });
    expect(eventService.deleteEvent).not.toHaveBeenCalled();
  });

  it("delegates to eventService and returns true when the user is a campaign member", async () => {
    const eventService = makeEventService();
    const campaignMemberService = makeCampaignMemberService();
    const event = makeEvent();
    vi.mocked(eventService.getEvent).mockResolvedValue(event);
    vi.mocked(campaignMemberService.getMembership).mockResolvedValue(
      membership,
    );
    vi.mocked(eventService.deleteEvent).mockResolvedValue(undefined);
    const context = makeContext(
      eventService,
      campaignMemberService,
      authenticatedUser,
    );

    const result = await Mutation.deleteEvent(
      undefined,
      { id: "event-1" },
      context,
    );

    expect(eventService.deleteEvent).toHaveBeenCalledWith("event-1");
    expect(result).toBe(true);
  });
});

describe("events Mutation.attachParticipant", () => {
  it("rejects with UNAUTHENTICATED when logged out", async () => {
    const eventService = makeEventService();
    const campaignMemberService = makeCampaignMemberService();
    const context = makeContext(
      eventService,
      campaignMemberService,
      loggedOutUser,
    );

    await expect(
      Mutation.attachParticipant(
        undefined,
        { eventId: "event-1", entityId: "entity-1" },
        context,
      ),
    ).rejects.toMatchObject({
      extensions: { code: "UNAUTHENTICATED" },
    });
    expect(eventService.attachParticipant).not.toHaveBeenCalled();
  });

  it("rejects with FORBIDDEN when not a member of the event's campaign", async () => {
    const eventService = makeEventService();
    const campaignMemberService = makeCampaignMemberService();
    const event = makeEvent();
    vi.mocked(eventService.getEvent).mockResolvedValue(event);
    vi.mocked(campaignMemberService.getMembership).mockResolvedValue(null);
    const context = makeContext(
      eventService,
      campaignMemberService,
      authenticatedUser,
    );

    await expect(
      Mutation.attachParticipant(
        undefined,
        { eventId: "event-1", entityId: "entity-1" },
        context,
      ),
    ).rejects.toMatchObject({ extensions: { code: "FORBIDDEN" } });
    expect(eventService.attachParticipant).not.toHaveBeenCalled();
  });

  it("delegates to eventService when the user is a campaign member", async () => {
    const eventService = makeEventService();
    const campaignMemberService = makeCampaignMemberService();
    const event = makeEvent();
    vi.mocked(eventService.getEvent).mockResolvedValue(event);
    vi.mocked(campaignMemberService.getMembership).mockResolvedValue(
      membership,
    );
    vi.mocked(eventService.attachParticipant).mockResolvedValue(event);
    const context = makeContext(
      eventService,
      campaignMemberService,
      authenticatedUser,
    );

    const result = await Mutation.attachParticipant(
      undefined,
      { eventId: "event-1", entityId: "entity-1", role: "witness" },
      context,
    );

    expect(eventService.attachParticipant).toHaveBeenCalledWith(
      "event-1",
      "entity-1",
      "witness",
    );
    expect(result).toBe(event);
  });
});

describe("events Mutation.detachParticipant", () => {
  it("rejects with UNAUTHENTICATED when logged out", async () => {
    const eventService = makeEventService();
    const campaignMemberService = makeCampaignMemberService();
    const context = makeContext(
      eventService,
      campaignMemberService,
      loggedOutUser,
    );

    await expect(
      Mutation.detachParticipant(
        undefined,
        { eventId: "event-1", entityId: "entity-1" },
        context,
      ),
    ).rejects.toMatchObject({
      extensions: { code: "UNAUTHENTICATED" },
    });
    expect(eventService.detachParticipant).not.toHaveBeenCalled();
  });

  it("rejects with FORBIDDEN when not a member of the event's campaign", async () => {
    const eventService = makeEventService();
    const campaignMemberService = makeCampaignMemberService();
    const event = makeEvent();
    vi.mocked(eventService.getEvent).mockResolvedValue(event);
    vi.mocked(campaignMemberService.getMembership).mockResolvedValue(null);
    const context = makeContext(
      eventService,
      campaignMemberService,
      authenticatedUser,
    );

    await expect(
      Mutation.detachParticipant(
        undefined,
        { eventId: "event-1", entityId: "entity-1" },
        context,
      ),
    ).rejects.toMatchObject({ extensions: { code: "FORBIDDEN" } });
    expect(eventService.detachParticipant).not.toHaveBeenCalled();
  });

  it("delegates to eventService when the user is a campaign member", async () => {
    const eventService = makeEventService();
    const campaignMemberService = makeCampaignMemberService();
    const event = makeEvent();
    vi.mocked(eventService.getEvent).mockResolvedValue(event);
    vi.mocked(campaignMemberService.getMembership).mockResolvedValue(
      membership,
    );
    vi.mocked(eventService.detachParticipant).mockResolvedValue(event);
    const context = makeContext(
      eventService,
      campaignMemberService,
      authenticatedUser,
    );

    const result = await Mutation.detachParticipant(
      undefined,
      { eventId: "event-1", entityId: "entity-1" },
      context,
    );

    expect(eventService.detachParticipant).toHaveBeenCalledWith(
      "event-1",
      "entity-1",
    );
    expect(result).toBe(event);
  });
});
