import { beforeEach, describe, expect, it, vi } from "vitest";
import { CampaignMember, User } from "@storyforge/domain";
import { Mutation } from "./Mutation";
import type { GraphQLContext } from "../../../../graphql/context";
import type { CampaignMemberService } from "../../application/CampaignMemberService";

function makeCampaignMemberService(): CampaignMemberService {
  return {
    listMembers: vi.fn(),
    getMembership: vi.fn(),
    addMember: vi.fn(),
    removeMember: vi.fn(),
    updateMemberRole: vi.fn(),
  } as unknown as CampaignMemberService;
}

function makeContext(
  campaignMemberService: CampaignMemberService,
  currentUser: User | null,
): GraphQLContext {
  return { campaignMemberService, currentUser } as GraphQLContext;
}

const campaignId = "campaign-1";
const loggedOutUser = null;
const ownerUser = User.create({
  email: "owner@example.com",
  password: "hashed",
});
const ownerMembership = CampaignMember.create({
  campaignId,
  userId: ownerUser.Id,
  role: "OWNER",
});

describe("campaignMembers Mutation", () => {
  let campaignMemberService: CampaignMemberService;

  beforeEach(() => {
    campaignMemberService = makeCampaignMemberService();
  });

  describe("addCampaignMember", () => {
    const args = {
      input: {
        campaignId,
        email: "player@example.com",
        role: "PLAYER" as const,
      },
    };

    it("rejects with UNAUTHENTICATED when logged out", async () => {
      const context = makeContext(campaignMemberService, loggedOutUser);

      await expect(
        Mutation.addCampaignMember(undefined, args, context),
      ).rejects.toMatchObject({
        extensions: { code: "UNAUTHENTICATED" },
      });
      expect(campaignMemberService.addMember).not.toHaveBeenCalled();
    });

    it("rejects with FORBIDDEN when the caller is not the owner", async () => {
      vi.mocked(campaignMemberService.getMembership).mockResolvedValue(null);
      const context = makeContext(campaignMemberService, ownerUser);

      await expect(
        Mutation.addCampaignMember(undefined, args, context),
      ).rejects.toMatchObject({
        extensions: { code: "FORBIDDEN" },
      });
      expect(campaignMemberService.addMember).not.toHaveBeenCalled();
    });

    it("delegates to campaignMemberService when the caller is the owner", async () => {
      vi.mocked(campaignMemberService.getMembership).mockResolvedValue(
        ownerMembership,
      );
      const newMember = CampaignMember.create({
        campaignId,
        userId: ownerUser.Id,
        role: "PLAYER",
      });
      vi.mocked(campaignMemberService.addMember).mockResolvedValue(newMember);
      const context = makeContext(campaignMemberService, ownerUser);

      const result = await Mutation.addCampaignMember(undefined, args, context);

      expect(campaignMemberService.addMember).toHaveBeenCalledWith(args.input);
      expect(result).toBe(newMember);
    });
  });

  describe("removeCampaignMember", () => {
    const args = { campaignId, userId: "user-1" };

    it("rejects with UNAUTHENTICATED when logged out", async () => {
      const context = makeContext(campaignMemberService, loggedOutUser);

      await expect(
        Mutation.removeCampaignMember(undefined, args, context),
      ).rejects.toMatchObject({
        extensions: { code: "UNAUTHENTICATED" },
      });
      expect(campaignMemberService.removeMember).not.toHaveBeenCalled();
    });

    it("rejects with FORBIDDEN when the caller is not the owner", async () => {
      vi.mocked(campaignMemberService.getMembership).mockResolvedValue(null);
      const context = makeContext(campaignMemberService, ownerUser);

      await expect(
        Mutation.removeCampaignMember(undefined, args, context),
      ).rejects.toMatchObject({
        extensions: { code: "FORBIDDEN" },
      });
      expect(campaignMemberService.removeMember).not.toHaveBeenCalled();
    });

    it("delegates to campaignMemberService and returns true when the caller is the owner", async () => {
      vi.mocked(campaignMemberService.getMembership).mockResolvedValue(
        ownerMembership,
      );
      vi.mocked(campaignMemberService.removeMember).mockResolvedValue(
        undefined,
      );
      const context = makeContext(campaignMemberService, ownerUser);

      const result = await Mutation.removeCampaignMember(
        undefined,
        args,
        context,
      );

      expect(campaignMemberService.removeMember).toHaveBeenCalledWith(
        campaignId,
        "user-1",
      );
      expect(result).toBe(true);
    });
  });

  describe("updateCampaignMemberRole", () => {
    const args = {
      input: { campaignId, userId: "user-1", role: "STORYTELLER" as const },
    };

    it("rejects with UNAUTHENTICATED when logged out", async () => {
      const context = makeContext(campaignMemberService, loggedOutUser);

      await expect(
        Mutation.updateCampaignMemberRole(undefined, args, context),
      ).rejects.toMatchObject({
        extensions: { code: "UNAUTHENTICATED" },
      });
      expect(campaignMemberService.updateMemberRole).not.toHaveBeenCalled();
    });

    it("rejects with FORBIDDEN when the caller is not the owner", async () => {
      vi.mocked(campaignMemberService.getMembership).mockResolvedValue(null);
      const context = makeContext(campaignMemberService, ownerUser);

      await expect(
        Mutation.updateCampaignMemberRole(undefined, args, context),
      ).rejects.toMatchObject({
        extensions: { code: "FORBIDDEN" },
      });
      expect(campaignMemberService.updateMemberRole).not.toHaveBeenCalled();
    });

    it("delegates to campaignMemberService when the caller is the owner", async () => {
      vi.mocked(campaignMemberService.getMembership).mockResolvedValue(
        ownerMembership,
      );
      const updated = CampaignMember.create({
        campaignId,
        userId: ownerUser.Id,
        role: "STORYTELLER",
      });
      vi.mocked(campaignMemberService.updateMemberRole).mockResolvedValue(
        updated,
      );
      const context = makeContext(campaignMemberService, ownerUser);

      const result = await Mutation.updateCampaignMemberRole(
        undefined,
        args,
        context,
      );

      expect(campaignMemberService.updateMemberRole).toHaveBeenCalledWith(
        args.input,
      );
      expect(result).toBe(updated);
    });
  });
});
