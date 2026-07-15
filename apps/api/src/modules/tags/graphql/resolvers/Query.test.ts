import { describe, expect, it, vi } from "vitest";
import { CampaignMember, Tag, User } from "@storyforge/domain";
import { Query } from "./Query";
import type { GraphQLContext } from "../../../../graphql/context";
import type { TagService } from "../../application/TagService";
import type { CampaignMemberService } from "../../../campaignMembers/application/CampaignMemberService";

function makeTagService(): TagService {
  return {
    listCampaignTags: vi.fn(),
    listEntityTags: vi.fn(),
    addTagToEntity: vi.fn(),
    removeTagFromEntity: vi.fn(),
  } as unknown as TagService;
}

function makeCampaignMemberService(): CampaignMemberService {
  return { getMembership: vi.fn() } as unknown as CampaignMemberService;
}

function makeContext(
  tagService: TagService,
  campaignMemberService: CampaignMemberService,
  currentUser: User | null,
): GraphQLContext {
  return { tagService, campaignMemberService, currentUser } as GraphQLContext;
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

const tag = Tag.create({ campaignId: "campaign-1", name: "villain" });

describe("tags Query.campaignTags", () => {
  it("rejects with UNAUTHENTICATED when logged out", async () => {
    const tagService = makeTagService();
    const campaignMemberService = makeCampaignMemberService();
    const context = makeContext(
      tagService,
      campaignMemberService,
      loggedOutUser,
    );

    await expect(
      Query.campaignTags(undefined, { campaignId: "campaign-1" }, context),
    ).rejects.toMatchObject({
      extensions: { code: "UNAUTHENTICATED" },
    });
    expect(tagService.listCampaignTags).not.toHaveBeenCalled();
  });

  it("rejects with FORBIDDEN when not a campaign member", async () => {
    const tagService = makeTagService();
    const campaignMemberService = makeCampaignMemberService();
    vi.mocked(campaignMemberService.getMembership).mockResolvedValue(null);
    const context = makeContext(
      tagService,
      campaignMemberService,
      authenticatedUser,
    );

    await expect(
      Query.campaignTags(undefined, { campaignId: "campaign-1" }, context),
    ).rejects.toMatchObject({ extensions: { code: "FORBIDDEN" } });
    expect(tagService.listCampaignTags).not.toHaveBeenCalled();
  });

  it("delegates to tagService when the user is a campaign member", async () => {
    const tagService = makeTagService();
    const campaignMemberService = makeCampaignMemberService();
    vi.mocked(campaignMemberService.getMembership).mockResolvedValue(
      membership,
    );
    vi.mocked(tagService.listCampaignTags).mockResolvedValue([tag]);
    const context = makeContext(
      tagService,
      campaignMemberService,
      authenticatedUser,
    );

    const result = await Query.campaignTags(
      undefined,
      { campaignId: "campaign-1" },
      context,
    );

    expect(tagService.listCampaignTags).toHaveBeenCalledWith("campaign-1");
    expect(result).toEqual([tag]);
  });
});
