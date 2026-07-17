import { describe, expect, it } from "vitest";
import { CampaignMember } from "./CampaignMember";
import { UserId } from "../user";

describe("CampaignMember", () => {
  it("creates a member with the given role and fresh timestamps", () => {
    const userId = UserId.create();

    const member = CampaignMember.create({
      campaignId: "campaign-1",
      userId,
      role: "PLAYER",
    });

    expect(member.CampaignId).toBe("campaign-1");
    expect(member.UserId.equals(userId)).toBe(true);
    expect(member.Role).toBe("PLAYER");
    expect(member.CreatedAt).toBeInstanceOf(Date);
    expect(member.UpdatedAt).toBeInstanceOf(Date);
  });

  it("rehydrates preserving the given timestamps", () => {
    const userId = UserId.create();
    const createdAt = new Date("2024-01-01T00:00:00Z");
    const updatedAt = new Date("2024-02-01T00:00:00Z");

    const member = CampaignMember.rehydrate({
      campaignId: "campaign-1",
      userId,
      role: "OWNER",
      createdAt,
      updatedAt,
    });

    expect(member.CreatedAt).toBe(createdAt);
    expect(member.UpdatedAt).toBe(updatedAt);
  });

  it("changes the role and bumps updatedAt", async () => {
    const member = CampaignMember.create({
      campaignId: "campaign-1",
      userId: UserId.create(),
      role: "PLAYER",
    });
    const before = member.UpdatedAt;

    await new Promise((resolve) => setTimeout(resolve, 5));
    member.changeRole("STORYTELLER");

    expect(member.Role).toBe("STORYTELLER");
    expect(member.UpdatedAt.getTime()).toBeGreaterThan(before.getTime());
  });

  it.each([
    "OWNER",
    "STORYTELLER",
    "CO_STORYTELLER",
    "PLAYER",
    "OBSERVER",
  ] as const)("creates a member with role %s", (role) => {
    const member = CampaignMember.create({
      campaignId: "campaign-1",
      userId: UserId.create(),
      role,
    });

    expect(member.Role).toBe(role);
  });

  it.each([
    "OWNER",
    "STORYTELLER",
    "CO_STORYTELLER",
    "PLAYER",
    "OBSERVER",
  ] as const)("changes the role to %s", (role) => {
    const member = CampaignMember.create({
      campaignId: "campaign-1",
      userId: UserId.create(),
      role: "PLAYER",
    });

    member.changeRole(role);

    expect(member.Role).toBe(role);
  });
});
