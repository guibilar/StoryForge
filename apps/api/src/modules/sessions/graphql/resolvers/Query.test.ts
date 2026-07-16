import { describe, expect, it, vi } from "vitest";
import {
  CampaignMember,
  NotFoundError,
  Session,
  User,
} from "@storyforge/domain";
import { Query } from "./Query";
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
  role: "PLAYER",
});

describe("sessions Query.session", () => {
  it("rejects with UNAUTHENTICATED when logged out", async () => {
    const sessionService = makeSessionService();
    const campaignMemberService = makeCampaignMemberService();
    const context = makeContext(
      sessionService,
      campaignMemberService,
      loggedOutUser,
    );

    await expect(
      Query.session(undefined, { id: "session-1" }, context),
    ).rejects.toMatchObject({
      extensions: { code: "UNAUTHENTICATED" },
    });
    expect(sessionService.getSession).not.toHaveBeenCalled();
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
      Query.session(undefined, { id: "session-1" }, context),
    ).rejects.toMatchObject({ extensions: { code: "FORBIDDEN" } });
  });

  it("returns the session when the user is a campaign member", async () => {
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
    const context = makeContext(
      sessionService,
      campaignMemberService,
      authenticatedUser,
    );

    const result = await Query.session(undefined, { id: "session-1" }, context);

    expect(sessionService.getSession).toHaveBeenCalledWith("session-1");
    expect(result).toBe(session);
  });

  it("translates domain errors into GraphQL errors", async () => {
    const sessionService = makeSessionService();
    const campaignMemberService = makeCampaignMemberService();
    vi.mocked(sessionService.getSession).mockRejectedValue(
      new NotFoundError("Session not found"),
    );
    const context = makeContext(
      sessionService,
      campaignMemberService,
      authenticatedUser,
    );

    await expect(
      Query.session(undefined, { id: "missing" }, context),
    ).rejects.toMatchObject({ extensions: { code: "NOT_FOUND" } });
  });
});

describe("sessions Query.sessions", () => {
  it("rejects with UNAUTHENTICATED when logged out", async () => {
    const sessionService = makeSessionService();
    const campaignMemberService = makeCampaignMemberService();
    const context = makeContext(
      sessionService,
      campaignMemberService,
      loggedOutUser,
    );

    await expect(
      Query.sessions(undefined, { campaignId: "campaign-1" }, context),
    ).rejects.toMatchObject({
      extensions: { code: "UNAUTHENTICATED" },
    });
    expect(sessionService.listSessions).not.toHaveBeenCalled();
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

    await expect(
      Query.sessions(undefined, { campaignId: "campaign-1" }, context),
    ).rejects.toMatchObject({ extensions: { code: "FORBIDDEN" } });
    expect(sessionService.listSessions).not.toHaveBeenCalled();
  });

  it("delegates to the service", async () => {
    const sessionService = makeSessionService();
    const campaignMemberService = makeCampaignMemberService();
    vi.mocked(campaignMemberService.getMembership).mockResolvedValue(
      membership,
    );
    const sessions = [
      Session.create({
        campaignId: "campaign-1",
        sessionNumber: 1,
        date: new Date("2024-01-01T00:00:00Z"),
      }),
    ];
    vi.mocked(sessionService.listSessions).mockResolvedValue(sessions);
    const context = makeContext(
      sessionService,
      campaignMemberService,
      authenticatedUser,
    );

    const result = await Query.sessions(
      undefined,
      { campaignId: "campaign-1" },
      context,
    );

    expect(sessionService.listSessions).toHaveBeenCalledWith("campaign-1");
    expect(result).toBe(sessions);
  });
});
