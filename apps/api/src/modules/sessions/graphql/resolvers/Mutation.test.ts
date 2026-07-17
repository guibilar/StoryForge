import { describe, expect, it, vi } from "vitest";
import { CampaignMember, Session, User } from "@storyforge/domain";
import { Mutation } from "./Mutation";
import type { GraphQLContext } from "../../../../graphql/context";
import type { SessionService } from "../../application/SessionService";
import type { CampaignMemberService } from "../../../campaignMembers/application/CampaignMemberService";

function makeSessionService(): SessionService {
  return {
    createSession: vi.fn(),
    updateSession: vi.fn(),
    deleteSession: vi.fn(),
    getSession: vi.fn(),
    listSessions: vi.fn(),
    attachAttendee: vi.fn(),
    detachAttendee: vi.fn(),
    listAttendeeUserIds: vi.fn(),
  } as unknown as SessionService;
}

function makeCampaignMemberService(): CampaignMemberService {
  return { getMembership: vi.fn() } as unknown as CampaignMemberService;
}

function makeContext(
  sessionService: SessionService,
  campaignMemberService: CampaignMemberService,
  currentUser: User | null,
): GraphQLContext {
  return {
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
  role: "STORYTELLER",
});

const playerMembership = CampaignMember.create({
  campaignId: "campaign-1",
  userId: authenticatedUser.Id,
  role: "PLAYER",
});

describe("sessions Mutation.createSession", () => {
  it("rejects with UNAUTHENTICATED when logged out", async () => {
    const sessionService = makeSessionService();
    const campaignMemberService = makeCampaignMemberService();
    const context = makeContext(
      sessionService,
      campaignMemberService,
      loggedOutUser,
    );
    const input = { campaignId: "campaign-1", date: "2024-01-01T00:00:00Z" };

    await expect(
      Mutation.createSession(undefined, { input }, context),
    ).rejects.toMatchObject({
      extensions: { code: "UNAUTHENTICATED" },
    });
    expect(sessionService.createSession).not.toHaveBeenCalled();
  });

  it("rejects with FORBIDDEN when not a campaign member", async () => {
    const sessionService = makeSessionService();
    const campaignMemberService = makeCampaignMemberService();
    vi.mocked(campaignMemberService.getMembership).mockResolvedValue(null);
    const context = makeContext(
      sessionService,
      campaignMemberService,
      authenticatedUser,
    );
    const input = { campaignId: "campaign-1", date: "2024-01-01T00:00:00Z" };

    await expect(
      Mutation.createSession(undefined, { input }, context),
    ).rejects.toMatchObject({ extensions: { code: "FORBIDDEN" } });
    expect(sessionService.createSession).not.toHaveBeenCalled();
  });

  it("rejects with FORBIDDEN when the member's role cannot write", async () => {
    const sessionService = makeSessionService();
    const campaignMemberService = makeCampaignMemberService();
    vi.mocked(campaignMemberService.getMembership).mockResolvedValue(
      playerMembership,
    );
    const context = makeContext(
      sessionService,
      campaignMemberService,
      authenticatedUser,
    );
    const input = { campaignId: "campaign-1", date: "2024-01-01T00:00:00Z" };

    await expect(
      Mutation.createSession(undefined, { input }, context),
    ).rejects.toMatchObject({ extensions: { code: "FORBIDDEN" } });
    expect(sessionService.createSession).not.toHaveBeenCalled();
  });

  it("delegates to sessionService when the user is a campaign member", async () => {
    const sessionService = makeSessionService();
    const campaignMemberService = makeCampaignMemberService();
    vi.mocked(campaignMemberService.getMembership).mockResolvedValue(
      membership,
    );
    const session = Session.create({
      campaignId: "campaign-1",
      sessionNumber: 1,
      date: new Date("2024-01-01T00:00:00Z"),
    });
    vi.mocked(sessionService.createSession).mockResolvedValue(session);
    const context = makeContext(
      sessionService,
      campaignMemberService,
      authenticatedUser,
    );
    const input = {
      campaignId: "campaign-1",
      date: "2024-01-01T00:00:00.000Z",
      summary: "The party arrived in town.",
    };

    const result = await Mutation.createSession(undefined, { input }, context);

    expect(sessionService.createSession).toHaveBeenCalledWith({
      campaignId: "campaign-1",
      date: new Date("2024-01-01T00:00:00.000Z"),
      summary: "The party arrived in town.",
    });
    expect(result).toBe(session);
  });
});

describe("sessions Mutation.updateSession", () => {
  it("rejects with UNAUTHENTICATED when logged out", async () => {
    const sessionService = makeSessionService();
    const campaignMemberService = makeCampaignMemberService();
    const context = makeContext(
      sessionService,
      campaignMemberService,
      loggedOutUser,
    );
    const input = { id: "session-1", summary: "Updated" };

    await expect(
      Mutation.updateSession(undefined, { input }, context),
    ).rejects.toMatchObject({
      extensions: { code: "UNAUTHENTICATED" },
    });
    expect(sessionService.updateSession).not.toHaveBeenCalled();
  });

  it("rejects with FORBIDDEN when not a member of the session's campaign", async () => {
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
      sessionService,
      campaignMemberService,
      authenticatedUser,
    );
    const input = { id: "session-1", summary: "Updated" };

    await expect(
      Mutation.updateSession(undefined, { input }, context),
    ).rejects.toMatchObject({ extensions: { code: "FORBIDDEN" } });
    expect(sessionService.updateSession).not.toHaveBeenCalled();
  });

  it("delegates to sessionService when the user is a campaign member", async () => {
    const sessionService = makeSessionService();
    const campaignMemberService = makeCampaignMemberService();
    const existing = Session.create({
      campaignId: "campaign-1",
      sessionNumber: 1,
      date: new Date("2024-01-01T00:00:00Z"),
    });
    vi.mocked(sessionService.getSession).mockResolvedValue(existing);
    vi.mocked(campaignMemberService.getMembership).mockResolvedValue(
      membership,
    );
    const updated = Session.create({
      campaignId: "campaign-1",
      sessionNumber: 1,
      date: new Date("2024-01-01T00:00:00Z"),
      summary: "Updated",
    });
    vi.mocked(sessionService.updateSession).mockResolvedValue(updated);
    const context = makeContext(
      sessionService,
      campaignMemberService,
      authenticatedUser,
    );
    const input = { id: "session-1", summary: "Updated" };

    const result = await Mutation.updateSession(undefined, { input }, context);

    expect(sessionService.updateSession).toHaveBeenCalledWith({
      id: "session-1",
      date: undefined,
      summary: "Updated",
    });
    expect(result).toBe(updated);
  });
});

describe("sessions Mutation.deleteSession", () => {
  it("rejects with UNAUTHENTICATED when logged out", async () => {
    const sessionService = makeSessionService();
    const campaignMemberService = makeCampaignMemberService();
    const context = makeContext(
      sessionService,
      campaignMemberService,
      loggedOutUser,
    );

    await expect(
      Mutation.deleteSession(undefined, { id: "session-1" }, context),
    ).rejects.toMatchObject({
      extensions: { code: "UNAUTHENTICATED" },
    });
    expect(sessionService.deleteSession).not.toHaveBeenCalled();
  });

  it("rejects with FORBIDDEN when not a member of the session's campaign", async () => {
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
      sessionService,
      campaignMemberService,
      authenticatedUser,
    );

    await expect(
      Mutation.deleteSession(undefined, { id: "session-1" }, context),
    ).rejects.toMatchObject({ extensions: { code: "FORBIDDEN" } });
    expect(sessionService.deleteSession).not.toHaveBeenCalled();
  });

  it("delegates to sessionService and returns true when the user is a campaign member", async () => {
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
    vi.mocked(sessionService.deleteSession).mockResolvedValue(undefined);
    const context = makeContext(
      sessionService,
      campaignMemberService,
      authenticatedUser,
    );

    const result = await Mutation.deleteSession(
      undefined,
      { id: "session-1" },
      context,
    );

    expect(sessionService.deleteSession).toHaveBeenCalledWith("session-1");
    expect(result).toBe(true);
  });
});

describe("sessions Mutation.attachSessionAttendee", () => {
  it("rejects with UNAUTHENTICATED when logged out", async () => {
    const sessionService = makeSessionService();
    const campaignMemberService = makeCampaignMemberService();
    const context = makeContext(
      sessionService,
      campaignMemberService,
      loggedOutUser,
    );

    await expect(
      Mutation.attachSessionAttendee(
        undefined,
        { sessionId: "session-1", userId: "user-1" },
        context,
      ),
    ).rejects.toMatchObject({
      extensions: { code: "UNAUTHENTICATED" },
    });
    expect(sessionService.attachAttendee).not.toHaveBeenCalled();
  });

  it("rejects with FORBIDDEN when not a member of the session's campaign", async () => {
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
      sessionService,
      campaignMemberService,
      authenticatedUser,
    );

    await expect(
      Mutation.attachSessionAttendee(
        undefined,
        { sessionId: "session-1", userId: "user-1" },
        context,
      ),
    ).rejects.toMatchObject({ extensions: { code: "FORBIDDEN" } });
    expect(sessionService.attachAttendee).not.toHaveBeenCalled();
  });

  it("delegates to sessionService when the user is a campaign member", async () => {
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
    vi.mocked(sessionService.attachAttendee).mockResolvedValue(session);
    const context = makeContext(
      sessionService,
      campaignMemberService,
      authenticatedUser,
    );

    const result = await Mutation.attachSessionAttendee(
      undefined,
      { sessionId: "session-1", userId: "user-1" },
      context,
    );

    expect(sessionService.attachAttendee).toHaveBeenCalledWith(
      "session-1",
      "user-1",
    );
    expect(result).toBe(session);
  });
});

describe("sessions Mutation.detachSessionAttendee", () => {
  it("rejects with UNAUTHENTICATED when logged out", async () => {
    const sessionService = makeSessionService();
    const campaignMemberService = makeCampaignMemberService();
    const context = makeContext(
      sessionService,
      campaignMemberService,
      loggedOutUser,
    );

    await expect(
      Mutation.detachSessionAttendee(
        undefined,
        { sessionId: "session-1", userId: "user-1" },
        context,
      ),
    ).rejects.toMatchObject({
      extensions: { code: "UNAUTHENTICATED" },
    });
    expect(sessionService.detachAttendee).not.toHaveBeenCalled();
  });

  it("rejects with FORBIDDEN when not a member of the session's campaign", async () => {
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
      sessionService,
      campaignMemberService,
      authenticatedUser,
    );

    await expect(
      Mutation.detachSessionAttendee(
        undefined,
        { sessionId: "session-1", userId: "user-1" },
        context,
      ),
    ).rejects.toMatchObject({ extensions: { code: "FORBIDDEN" } });
    expect(sessionService.detachAttendee).not.toHaveBeenCalled();
  });

  it("delegates to sessionService when the user is a campaign member", async () => {
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
    vi.mocked(sessionService.detachAttendee).mockResolvedValue(session);
    const context = makeContext(
      sessionService,
      campaignMemberService,
      authenticatedUser,
    );

    const result = await Mutation.detachSessionAttendee(
      undefined,
      { sessionId: "session-1", userId: "user-1" },
      context,
    );

    expect(sessionService.detachAttendee).toHaveBeenCalledWith(
      "session-1",
      "user-1",
    );
    expect(result).toBe(session);
  });
});
