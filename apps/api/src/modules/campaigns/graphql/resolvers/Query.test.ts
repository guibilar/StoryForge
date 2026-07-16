import { beforeEach, describe, expect, it, vi } from "vitest";
import { Campaign, CampaignMember, User } from "@storyforge/domain";
import { Query } from "./Query";
import type { GraphQLContext } from "../../../../graphql/context";
import type { CampaignService } from "../../application/CampaignService";
import type { CampaignMemberService } from "../../../campaignMembers/application/CampaignMemberService";

function makeCampaignService(): CampaignService {
  return {
    createCampaign: vi.fn(),
    getCampaignById: vi.fn(),
    updateCampaign: vi.fn(),
    archiveCampaign: vi.fn(),
    listCampaigns: vi.fn(),
  } as unknown as CampaignService;
}

function makeCampaignMemberService(): CampaignMemberService {
  return { getMembership: vi.fn() } as unknown as CampaignMemberService;
}

function makeContext(
  campaignService: CampaignService,
  campaignMemberService: CampaignMemberService,
  currentUser: User | null,
): GraphQLContext {
  return {
    campaignService,
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

describe("campaigns Query", () => {
  let campaignService: CampaignService;
  let campaignMemberService: CampaignMemberService;

  beforeEach(() => {
    campaignService = makeCampaignService();
    campaignMemberService = makeCampaignMemberService();
  });

  describe("campaign", () => {
    it("rejects with UNAUTHENTICATED when logged out", async () => {
      const context = makeContext(
        campaignService,
        campaignMemberService,
        loggedOutUser,
      );

      await expect(
        Query.campaign(undefined, { id: "campaign-1" }, context),
      ).rejects.toMatchObject({
        extensions: { code: "UNAUTHENTICATED" },
      });
      expect(campaignService.getCampaignById).not.toHaveBeenCalled();
    });

    it("rejects with FORBIDDEN when not a campaign member", async () => {
      vi.mocked(campaignMemberService.getMembership).mockResolvedValue(null);
      const context = makeContext(
        campaignService,
        campaignMemberService,
        authenticatedUser,
      );

      await expect(
        Query.campaign(undefined, { id: "campaign-1" }, context),
      ).rejects.toMatchObject({
        extensions: { code: "FORBIDDEN" },
      });
      expect(campaignService.getCampaignById).not.toHaveBeenCalled();
    });

    it("delegates to campaignService when authenticated", async () => {
      const campaign = { id: "campaign-1" } as unknown as Campaign;
      vi.mocked(campaignService.getCampaignById).mockResolvedValue(campaign);
      vi.mocked(campaignMemberService.getMembership).mockResolvedValue(
        membership,
      );
      const context = makeContext(
        campaignService,
        campaignMemberService,
        authenticatedUser,
      );

      const result = await Query.campaign(
        undefined,
        { id: "campaign-1" },
        context,
      );

      expect(campaignService.getCampaignById).toHaveBeenCalledWith(
        "campaign-1",
      );
      expect(result).toBe(campaign);
    });
  });

  describe("campaigns", () => {
    it("rejects with UNAUTHENTICATED when logged out", async () => {
      const context = makeContext(
        campaignService,
        campaignMemberService,
        loggedOutUser,
      );

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
      const context = makeContext(
        campaignService,
        campaignMemberService,
        authenticatedUser,
      );

      const result = await Query.campaigns(undefined, {}, context);

      expect(campaignService.listCampaigns).toHaveBeenCalledWith(
        authenticatedUser.Id.toString(),
      );
      expect(result).toBe(campaigns);
    });
  });
});
