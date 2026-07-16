import { describe, expect, it, vi } from "vitest";
import {
  CampaignMember as DomainCampaignMember,
  User,
} from "@storyforge/domain";
import { CampaignMember } from "./CampaignMember";
import type { GraphQLContext } from "../../../../graphql/context";

describe("CampaignMember.user", () => {
  it("resolves the member's user via the user repository", async () => {
    const user = User.create({
      email: "owner@example.com",
      password: "hashed",
    });
    const member = DomainCampaignMember.create({
      campaignId: "campaign-1",
      userId: user.Id,
      role: "OWNER",
    });
    const findById = vi.fn().mockResolvedValue(user);
    const context = {
      userRepository: { findById },
    } as unknown as GraphQLContext;

    const result = await CampaignMember.user(member, {}, context);

    expect(findById).toHaveBeenCalledWith(member.UserId);
    expect(result).toBe(user);
  });
});
