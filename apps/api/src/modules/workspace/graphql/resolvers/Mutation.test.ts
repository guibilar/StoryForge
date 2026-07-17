import { describe, expect, it, vi } from "vitest";
import { CampaignMember, User, WorkspaceState } from "@storyforge/domain";
import { Mutation } from "./Mutation";
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

const savedState = WorkspaceState.create({
  userId: authenticatedUser.Id.toString(),
  campaignId: "campaign-1",
  layout: { npcs: { x: 1, y: 2, width: 3, height: 4 } },
  recentEntityIds: ["entity-1"],
});

describe("workspace Mutation.saveWorkspaceState", () => {
  const validArgs = {
    input: {
      campaignId: "campaign-1",
      layout: JSON.stringify({ npcs: { x: 1, y: 2, width: 3, height: 4 } }),
      recentEntityIds: JSON.stringify(["entity-1"]),
    },
  };

  it("rejects with UNAUTHENTICATED when logged out", async () => {
    const workspaceService = makeWorkspaceService();
    const campaignMemberService = makeCampaignMemberService();
    const context = makeContext(
      workspaceService,
      campaignMemberService,
      loggedOutUser,
    );

    await expect(
      Mutation.saveWorkspaceState(undefined, validArgs, context),
    ).rejects.toMatchObject({ extensions: { code: "UNAUTHENTICATED" } });
    expect(workspaceService.saveWorkspaceState).not.toHaveBeenCalled();
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
      Mutation.saveWorkspaceState(undefined, validArgs, context),
    ).rejects.toMatchObject({ extensions: { code: "FORBIDDEN" } });
    expect(workspaceService.saveWorkspaceState).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON in layout with BAD_USER_INPUT", async () => {
    const workspaceService = makeWorkspaceService();
    const campaignMemberService = makeCampaignMemberService();
    vi.mocked(campaignMemberService.getMembership).mockResolvedValue(
      membership,
    );
    const context = makeContext(
      workspaceService,
      campaignMemberService,
      authenticatedUser,
    );

    await expect(
      Mutation.saveWorkspaceState(
        undefined,
        { input: { ...validArgs.input, layout: "{not json" } },
        context,
      ),
    ).rejects.toMatchObject({ extensions: { code: "BAD_USER_INPUT" } });
    expect(workspaceService.saveWorkspaceState).not.toHaveBeenCalled();
  });

  it("rejects a layout that isn't a JSON object", async () => {
    const workspaceService = makeWorkspaceService();
    const campaignMemberService = makeCampaignMemberService();
    vi.mocked(campaignMemberService.getMembership).mockResolvedValue(
      membership,
    );
    const context = makeContext(
      workspaceService,
      campaignMemberService,
      authenticatedUser,
    );

    await expect(
      Mutation.saveWorkspaceState(
        undefined,
        { input: { ...validArgs.input, layout: "[1,2,3]" } },
        context,
      ),
    ).rejects.toMatchObject({ extensions: { code: "BAD_USER_INPUT" } });
  });

  it("rejects recentEntityIds that isn't a JSON array of strings", async () => {
    const workspaceService = makeWorkspaceService();
    const campaignMemberService = makeCampaignMemberService();
    vi.mocked(campaignMemberService.getMembership).mockResolvedValue(
      membership,
    );
    const context = makeContext(
      workspaceService,
      campaignMemberService,
      authenticatedUser,
    );

    await expect(
      Mutation.saveWorkspaceState(
        undefined,
        {
          input: {
            ...validArgs.input,
            recentEntityIds: JSON.stringify([1, 2, 3]),
          },
        },
        context,
      ),
    ).rejects.toMatchObject({ extensions: { code: "BAD_USER_INPUT" } });
  });

  it("parses the JSON strings and delegates to workspaceService, scoped to the current user", async () => {
    const workspaceService = makeWorkspaceService();
    const campaignMemberService = makeCampaignMemberService();
    vi.mocked(campaignMemberService.getMembership).mockResolvedValue(
      membership,
    );
    vi.mocked(workspaceService.saveWorkspaceState).mockResolvedValue(
      savedState,
    );
    const context = makeContext(
      workspaceService,
      campaignMemberService,
      authenticatedUser,
    );

    const result = await Mutation.saveWorkspaceState(
      undefined,
      validArgs,
      context,
    );

    expect(workspaceService.saveWorkspaceState).toHaveBeenCalledWith(
      authenticatedUser.Id.toString(),
      {
        campaignId: "campaign-1",
        layout: { npcs: { x: 1, y: 2, width: 3, height: 4 } },
        recentEntityIds: ["entity-1"],
      },
    );
    expect(result).toBe(savedState);
  });
});
