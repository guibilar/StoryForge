import { describe, expect, it, vi } from "vitest";
import { CampaignMember, User, WorkspaceState } from "@storyforge/domain";
import { Query } from "./Query";
import type { GraphQLContext } from "../../../../graphql/context";
import type { WorkspaceService } from "../../application/WorkspaceService";
import type { CampaignMemberService } from "../../../campaignMembers/application/CampaignMemberService";

function makeWorkspaceService(): WorkspaceService {
  return {
    getWorkspaceState: vi.fn(),
    saveWorkspaceState: vi.fn(),
  } as unknown as WorkspaceService;
}

function makeCampaignMemberService(): CampaignMemberService {
  return { getMembership: vi.fn() } as unknown as CampaignMemberService;
}

function makeContext(
  workspaceService: WorkspaceService,
  campaignMemberService: CampaignMemberService,
  currentUser: User | null,
): GraphQLContext {
  return {
    workspaceService,
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

const workspaceState = WorkspaceState.create({
  userId: authenticatedUser.Id.toString(),
  campaignId: "campaign-1",
  layout: { npcs: { x: 1, y: 2, width: 3, height: 4 } },
  recentEntityIds: ["entity-1"],
});

describe("workspace Query.myWorkspaceState", () => {
  it("rejects with UNAUTHENTICATED when logged out", async () => {
    const workspaceService = makeWorkspaceService();
    const campaignMemberService = makeCampaignMemberService();
    const context = makeContext(
      workspaceService,
      campaignMemberService,
      loggedOutUser,
    );

    await expect(
      Query.myWorkspaceState(undefined, { campaignId: "campaign-1" }, context),
    ).rejects.toMatchObject({ extensions: { code: "UNAUTHENTICATED" } });
    expect(workspaceService.getWorkspaceState).not.toHaveBeenCalled();
  });

  it("rejects with FORBIDDEN when not a campaign member", async () => {
    const workspaceService = makeWorkspaceService();
    const campaignMemberService = makeCampaignMemberService();
    vi.mocked(campaignMemberService.getMembership).mockResolvedValue(null);
    const context = makeContext(
      workspaceService,
      campaignMemberService,
      authenticatedUser,
    );

    await expect(
      Query.myWorkspaceState(undefined, { campaignId: "campaign-1" }, context),
    ).rejects.toMatchObject({ extensions: { code: "FORBIDDEN" } });
    expect(workspaceService.getWorkspaceState).not.toHaveBeenCalled();
  });

  it("returns the current user's saved state, scoped to their own id", async () => {
    const workspaceService = makeWorkspaceService();
    const campaignMemberService = makeCampaignMemberService();
    vi.mocked(campaignMemberService.getMembership).mockResolvedValue(
      membership,
    );
    vi.mocked(workspaceService.getWorkspaceState).mockResolvedValue(
      workspaceState,
    );
    const context = makeContext(
      workspaceService,
      campaignMemberService,
      authenticatedUser,
    );

    const result = await Query.myWorkspaceState(
      undefined,
      { campaignId: "campaign-1" },
      context,
    );

    expect(workspaceService.getWorkspaceState).toHaveBeenCalledWith(
      authenticatedUser.Id.toString(),
      "campaign-1",
    );
    expect(result).toBe(workspaceState);
  });

  it("returns null when the user has never saved a workspace state", async () => {
    const workspaceService = makeWorkspaceService();
    const campaignMemberService = makeCampaignMemberService();
    vi.mocked(campaignMemberService.getMembership).mockResolvedValue(
      membership,
    );
    vi.mocked(workspaceService.getWorkspaceState).mockResolvedValue(null);
    const context = makeContext(
      workspaceService,
      campaignMemberService,
      authenticatedUser,
    );

    const result = await Query.myWorkspaceState(
      undefined,
      { campaignId: "campaign-1" },
      context,
    );

    expect(result).toBeNull();
  });
});
