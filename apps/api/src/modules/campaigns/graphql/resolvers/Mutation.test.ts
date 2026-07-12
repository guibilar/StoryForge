import { beforeEach, describe, expect, it, vi } from "vitest";
import { Campaign, User } from "@storyforge/domain";
import { Mutation } from "./Mutation";
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

describe("campaigns Mutation", () => {
  let campaignService: CampaignService;

  beforeEach(() => {
    campaignService = makeCampaignService();
  });

  describe("createCampaign", () => {
    const args = { input: { name: "Test", description: "desc" } };

    it("rejects with UNAUTHENTICATED when logged out", async () => {
      const context = makeContext(campaignService, loggedOutUser);

      await expect(
        Mutation.createCampaign(undefined, args, context),
      ).rejects.toMatchObject({
        extensions: { code: "UNAUTHENTICATED" },
      });
      expect(campaignService.createCampaign).not.toHaveBeenCalled();
    });

    it("delegates to campaignService when authenticated", async () => {
      const campaign = { id: "campaign-1" } as unknown as Campaign;
      vi.mocked(campaignService.createCampaign).mockResolvedValue(campaign);
      const context = makeContext(campaignService, authenticatedUser);

      const result = await Mutation.createCampaign(undefined, args, context);

      expect(campaignService.createCampaign).toHaveBeenCalledWith(args);
      expect(result).toBe(campaign);
    });
  });

  describe("updateCampaign", () => {
    const args = { input: { id: "campaign-1", name: "Renamed" } };

    it("rejects with UNAUTHENTICATED when logged out", async () => {
      const context = makeContext(campaignService, loggedOutUser);

      await expect(
        Mutation.updateCampaign(undefined, args, context),
      ).rejects.toMatchObject({
        extensions: { code: "UNAUTHENTICATED" },
      });
      expect(campaignService.updateCampaign).not.toHaveBeenCalled();
    });

    it("delegates to campaignService when authenticated", async () => {
      const campaign = { id: "campaign-1" } as unknown as Campaign;
      vi.mocked(campaignService.updateCampaign).mockResolvedValue(campaign);
      const context = makeContext(campaignService, authenticatedUser);

      const result = await Mutation.updateCampaign(undefined, args, context);

      expect(campaignService.updateCampaign).toHaveBeenCalledWith(args);
      expect(result).toBe(campaign);
    });
  });

  describe("archiveCampaign", () => {
    const args = { id: "campaign-1" };

    it("rejects with UNAUTHENTICATED when logged out", async () => {
      const context = makeContext(campaignService, loggedOutUser);

      await expect(
        Mutation.archiveCampaign(undefined, args, context),
      ).rejects.toMatchObject({
        extensions: { code: "UNAUTHENTICATED" },
      });
      expect(campaignService.archiveCampaign).not.toHaveBeenCalled();
    });

    it("delegates to campaignService and returns true when authenticated", async () => {
      vi.mocked(campaignService.archiveCampaign).mockResolvedValue(undefined);
      const context = makeContext(campaignService, authenticatedUser);

      const result = await Mutation.archiveCampaign(undefined, args, context);

      expect(campaignService.archiveCampaign).toHaveBeenCalledWith(
        "campaign-1",
      );
      expect(result).toBe(true);
    });
  });
});
