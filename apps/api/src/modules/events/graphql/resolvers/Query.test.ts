import { describe, expect, it, vi } from "vitest";
import {
  CampaignMember,
  Event,
  NotFoundError,
  Session,
  User,
} from "@storyforge/domain";
import { Query } from "./Query";
import type { GraphQLContext } from "../../../../graphql/context";
import type { EventService } from "../../application/EventService";
import type { SessionService } from "../../../sessions/application/SessionService";
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

function makeSessionService(): SessionService {
  return {
    getSession: vi.fn(),
    findSession: vi.fn(),
  } as unknown as SessionService;
}

function makeCampaignMemberService(): CampaignMemberService {
  return { getMembership: vi.fn() } as unknown as CampaignMemberService;
}

function makeContext(
  eventService: EventService,
  sessionService: SessionService,
  campaignMemberService: CampaignMemberService,
  currentUser: User | null,
): GraphQLContext {
  return {
    eventService,
    sessionService,
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

describe("events Query.event", () => {
  it("rejects with UNAUTHENTICATED when logged out", async () => {
    const eventService = makeEventService();
    const sessionService = makeSessionService();
    const campaignMemberService = makeCampaignMemberService();
    const context = makeContext(
      eventService,
      sessionService,
      campaignMemberService,
      loggedOutUser,
    );

    await expect(
      Query.event(undefined, { id: "event-1" }, context),
    ).rejects.toMatchObject({
      extensions: { code: "UNAUTHENTICATED" },
    });
    expect(eventService.getEvent).not.toHaveBeenCalled();
  });

  it("rejects with FORBIDDEN when not a member of the event's campaign", async () => {
    const eventService = makeEventService();
    const sessionService = makeSessionService();
    const campaignMemberService = makeCampaignMemberService();
    const event = makeEvent();
    vi.mocked(eventService.getEvent).mockResolvedValue(event);
    vi.mocked(campaignMemberService.getMembership).mockResolvedValue(null);
    const context = makeContext(
      eventService,
      sessionService,
      campaignMemberService,
      authenticatedUser,
    );

    await expect(
      Query.event(undefined, { id: "event-1" }, context),
    ).rejects.toMatchObject({ extensions: { code: "FORBIDDEN" } });
  });

  it("returns the event when the user is a campaign member", async () => {
    const eventService = makeEventService();
    const sessionService = makeSessionService();
    const campaignMemberService = makeCampaignMemberService();
    const event = makeEvent();
    vi.mocked(eventService.getEvent).mockResolvedValue(event);
    vi.mocked(campaignMemberService.getMembership).mockResolvedValue(
      membership,
    );
    const context = makeContext(
      eventService,
      sessionService,
      campaignMemberService,
      authenticatedUser,
    );

    const result = await Query.event(undefined, { id: "event-1" }, context);

    expect(eventService.getEvent).toHaveBeenCalledWith("event-1");
    expect(result).toBe(event);
  });

  it("translates domain errors into GraphQL errors", async () => {
    const eventService = makeEventService();
    const sessionService = makeSessionService();
    const campaignMemberService = makeCampaignMemberService();
    vi.mocked(eventService.getEvent).mockRejectedValue(
      new NotFoundError("Event not found"),
    );
    const context = makeContext(
      eventService,
      sessionService,
      campaignMemberService,
      authenticatedUser,
    );

    await expect(
      Query.event(undefined, { id: "missing" }, context),
    ).rejects.toMatchObject({ extensions: { code: "NOT_FOUND" } });
  });
});

describe("events Query.events", () => {
  it("rejects with UNAUTHENTICATED when logged out", async () => {
    const eventService = makeEventService();
    const sessionService = makeSessionService();
    const campaignMemberService = makeCampaignMemberService();
    const context = makeContext(
      eventService,
      sessionService,
      campaignMemberService,
      loggedOutUser,
    );

    await expect(
      Query.events(undefined, { campaignId: "campaign-1" }, context),
    ).rejects.toMatchObject({
      extensions: { code: "UNAUTHENTICATED" },
    });
    expect(eventService.listEvents).not.toHaveBeenCalled();
  });

  it("rejects with FORBIDDEN when not a campaign member", async () => {
    const eventService = makeEventService();
    const sessionService = makeSessionService();
    const campaignMemberService = makeCampaignMemberService();
    vi.mocked(campaignMemberService.getMembership).mockResolvedValue(null);
    const context = makeContext(
      eventService,
      sessionService,
      campaignMemberService,
      authenticatedUser,
    );

    await expect(
      Query.events(undefined, { campaignId: "campaign-1" }, context),
    ).rejects.toMatchObject({ extensions: { code: "FORBIDDEN" } });
    expect(eventService.listEvents).not.toHaveBeenCalled();
  });

  it("delegates to the service", async () => {
    const eventService = makeEventService();
    const sessionService = makeSessionService();
    const campaignMemberService = makeCampaignMemberService();
    vi.mocked(campaignMemberService.getMembership).mockResolvedValue(
      membership,
    );
    const events = [makeEvent()];
    vi.mocked(eventService.listEvents).mockResolvedValue(events);
    const context = makeContext(
      eventService,
      sessionService,
      campaignMemberService,
      authenticatedUser,
    );

    const result = await Query.events(
      undefined,
      { campaignId: "campaign-1" },
      context,
    );

    expect(eventService.listEvents).toHaveBeenCalledWith("campaign-1");
    expect(result).toBe(events);
  });
});

describe("events Query.eventsBySession", () => {
  it("rejects with UNAUTHENTICATED when logged out", async () => {
    const eventService = makeEventService();
    const sessionService = makeSessionService();
    const campaignMemberService = makeCampaignMemberService();
    const context = makeContext(
      eventService,
      sessionService,
      campaignMemberService,
      loggedOutUser,
    );

    await expect(
      Query.eventsBySession(undefined, { sessionId: "session-1" }, context),
    ).rejects.toMatchObject({
      extensions: { code: "UNAUTHENTICATED" },
    });
    expect(eventService.listEventsBySession).not.toHaveBeenCalled();
  });

  it("rejects with FORBIDDEN when not a member of the session's campaign", async () => {
    const eventService = makeEventService();
    const sessionService = makeSessionService();
    const campaignMemberService = makeCampaignMemberService();
    const session = Session.create({
      campaignId: "campaign-1",
      sessionNumber: 1,
      date: new Date("2024-01-01T00:00:00Z"),
    });
    vi.mocked(sessionService.getSession).mockResolvedValue(session);
    vi.mocked(campaignMemberService.getMembership).mockResolvedValue(null);
    const context = makeContext(
      eventService,
      sessionService,
      campaignMemberService,
      authenticatedUser,
    );

    await expect(
      Query.eventsBySession(undefined, { sessionId: "session-1" }, context),
    ).rejects.toMatchObject({ extensions: { code: "FORBIDDEN" } });
    expect(eventService.listEventsBySession).not.toHaveBeenCalled();
  });

  it("delegates to the service", async () => {
    const eventService = makeEventService();
    const sessionService = makeSessionService();
    const campaignMemberService = makeCampaignMemberService();
    const session = Session.create({
      campaignId: "campaign-1",
      sessionNumber: 1,
      date: new Date("2024-01-01T00:00:00Z"),
    });
    vi.mocked(sessionService.getSession).mockResolvedValue(session);
    vi.mocked(campaignMemberService.getMembership).mockResolvedValue(
      membership,
    );
    const events = [makeEvent()];
    vi.mocked(eventService.listEventsBySession).mockResolvedValue(events);
    const context = makeContext(
      eventService,
      sessionService,
      campaignMemberService,
      authenticatedUser,
    );

    const result = await Query.eventsBySession(
      undefined,
      { sessionId: "session-1" },
      context,
    );

    expect(eventService.listEventsBySession).toHaveBeenCalledWith("session-1");
    expect(result).toBe(events);
  });
});
