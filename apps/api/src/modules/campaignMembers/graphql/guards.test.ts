import { describe, expect, it, vi } from "vitest";
import {
  AuthenticationError,
  CampaignMember,
  ForbiddenError,
  User,
} from "@storyforge/domain";
import { requireCampaignMember, requireCampaignOwner } from "./guards";
import type { GraphQLContext } from "../../../graphql/context";
import type { CampaignMemberService } from "../application/CampaignMemberService";

function makeContext(
  currentUser: User | null,
  campaignMemberService: Partial<CampaignMemberService>,
): GraphQLContext {
  return { currentUser, campaignMemberService } as GraphQLContext;
}

const campaignId = "campaign-1";
const user = User.create({ email: "owner@example.com", password: "hashed" });

describe("requireCampaignOwner", () => {
  it("throws AuthenticationError when logged out", async () => {
    const context = makeContext(null, { getMembership: vi.fn() });

    await expect(requireCampaignOwner(context, campaignId)).rejects.toThrow(
      AuthenticationError,
    );
  });

  it("throws ForbiddenError when the user has no membership", async () => {
    const context = makeContext(user, {
      getMembership: vi.fn().mockResolvedValue(null),
    });

    await expect(requireCampaignOwner(context, campaignId)).rejects.toThrow(
      ForbiddenError,
    );
  });

  it("throws ForbiddenError when the user is a member but not an owner", async () => {
    const membership = CampaignMember.create({
      campaignId,
      userId: user.Id,
      role: "PLAYER",
    });
    const context = makeContext(user, {
      getMembership: vi.fn().mockResolvedValue(membership),
    });

    await expect(requireCampaignOwner(context, campaignId)).rejects.toThrow(
      ForbiddenError,
    );
  });

  it("resolves when the user is the campaign owner", async () => {
    const membership = CampaignMember.create({
      campaignId,
      userId: user.Id,
      role: "OWNER",
    });
    const getMembership = vi.fn().mockResolvedValue(membership);
    const context = makeContext(user, { getMembership });

    await expect(
      requireCampaignOwner(context, campaignId),
    ).resolves.toBeUndefined();
    expect(getMembership).toHaveBeenCalledWith(campaignId, user.Id.toString());
  });
});

describe("requireCampaignMember", () => {
  it("throws AuthenticationError when logged out", async () => {
    const context = makeContext(null, { getMembership: vi.fn() });

    await expect(requireCampaignMember(context, campaignId)).rejects.toThrow(
      AuthenticationError,
    );
  });

  it("throws ForbiddenError when the user has no membership", async () => {
    const context = makeContext(user, {
      getMembership: vi.fn().mockResolvedValue(null),
    });

    await expect(requireCampaignMember(context, campaignId)).rejects.toThrow(
      ForbiddenError,
    );
  });

  it("resolves with the membership for any role", async () => {
    const membership = CampaignMember.create({
      campaignId,
      userId: user.Id,
      role: "PLAYER",
    });
    const getMembership = vi.fn().mockResolvedValue(membership);
    const context = makeContext(user, { getMembership });

    await expect(requireCampaignMember(context, campaignId)).resolves.toBe(
      membership,
    );
    expect(getMembership).toHaveBeenCalledWith(campaignId, user.Id.toString());
  });
});
