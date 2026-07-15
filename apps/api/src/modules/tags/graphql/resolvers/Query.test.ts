import { describe, expect, it, vi } from "vitest";
import { NotFoundError, Tag, User } from "@storyforge/domain";
import { Query } from "./Query";
import type { GraphQLContext } from "../../../../graphql/context";
import type { TagService } from "../../application/TagService";

function makeTagService(): TagService {
  return {
    listCampaignTags: vi.fn(),
    listEntityTags: vi.fn(),
    addTagToEntity: vi.fn(),
    removeTagFromEntity: vi.fn(),
  } as unknown as TagService;
}

function makeContext(
  tagService: TagService,
  currentUser: User | null,
): GraphQLContext {
  return { tagService, currentUser } as GraphQLContext;
}

const loggedOutUser = null;
const authenticatedUser = User.create({
  email: "user@example.com",
  password: "hashed",
});

const tag = Tag.create({ campaignId: "campaign-1", name: "villain" });

describe("tags Query.campaignTags", () => {
  it("rejects with UNAUTHENTICATED when logged out", async () => {
    const tagService = makeTagService();
    const context = makeContext(tagService, loggedOutUser);

    await expect(
      Query.campaignTags(undefined, { campaignId: "campaign-1" }, context),
    ).rejects.toMatchObject({
      extensions: { code: "UNAUTHENTICATED" },
    });
    expect(tagService.listCampaignTags).not.toHaveBeenCalled();
  });

  it("delegates to tagService when authenticated", async () => {
    const tagService = makeTagService();
    vi.mocked(tagService.listCampaignTags).mockResolvedValue([tag]);
    const context = makeContext(tagService, authenticatedUser);

    const result = await Query.campaignTags(
      undefined,
      { campaignId: "campaign-1" },
      context,
    );

    expect(tagService.listCampaignTags).toHaveBeenCalledWith("campaign-1");
    expect(result).toEqual([tag]);
  });

  it("translates domain errors into GraphQL errors", async () => {
    const tagService = makeTagService();
    vi.mocked(tagService.listCampaignTags).mockRejectedValue(
      new NotFoundError("Campaign not found"),
    );
    const context = makeContext(tagService, authenticatedUser);

    await expect(
      Query.campaignTags(undefined, { campaignId: "missing" }, context),
    ).rejects.toMatchObject({ extensions: { code: "NOT_FOUND" } });
  });
});
