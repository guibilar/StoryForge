import { beforeEach, describe, expect, it, vi } from "vitest";
import { Campaign, User } from "@storyforge/domain";
import { Query } from "./Query";
import type { GraphQLContext } from "../../../../graphql/context";
import type { CampaignService } from "../../application/CampaignService";

function makeCampaignService(): CampaignService {
  return {
    createCampaign: vi.fn(),
    getCampaignById: vi.fn(),
    updateCampaign: vi.fn(),
    archiveCampaign: vi.fn(),
    listCampaigns: vi.fn(),
  } as unknown as CampaignService;
}

function makeContext(
  campaignService: CampaignService,
  currentUser: User | null,
): GraphQLContext {
  return { campaignService, currentUser } as GraphQLContext;
}

const loggedOutUser = null;
const authenticatedUser = User.create({
  email: "user@example.com",
  password: "hashed",
});

describe("campaigns Query", () => {
  let campaignService: CampaignService;

  beforeEach(() => {
    campaignService = makeCampaignService();
  });

  describe("campaigns", () => {
    it("rejects with UNAUTHENTICATED when logged out", async () => {
      const context = makeContext(campaignService, loggedOutUser);

      await expect(
        Query.campaigns(undefined, {}, context),
      ).rejects.toMatchObject({
        extensions: { code: "UNAUTHENTICATED" },
      });
      expect(campaignService.listCampaigns).not.toHaveBeenCalled();
    });

    it("scopes the result to the current user's memberships", async () => {
      const campaigns = [Campaign.create({ name: "A" })];
      vi.mocked(campaignService.listCampaigns).mockResolvedValue(campaigns);
      const context = makeContext(campaignService, authenticatedUser);

      const result = await Query.campaigns(undefined, {}, context);

      expect(campaignService.listCampaigns).toHaveBeenCalledWith(
        authenticatedUser.Id.toString(),
      );
      expect(result).toBe(campaigns);
    });
  });
});
