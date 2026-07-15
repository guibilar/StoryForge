import { describe, expect, it } from "vitest";
import { CampaignMember, UserId } from "@storyforge/domain";
import type { CampaignMember as PrismaCampaignMember } from "@storyforge/database";
import { CampaignMemberMapper } from "./CampaignMemberMapper";

describe("CampaignMemberMapper", () => {
  it("maps a persistence record to a domain campaign member", () => {
    const record: PrismaCampaignMember = {
      id: "11111111-1111-1111-1111-111111111111",
      campaignId: "22222222-2222-2222-2222-222222222222",
      userId: "33333333-3333-3333-3333-333333333333",
      role: "STORYTELLER",
      createdAt: new Date("2024-01-01T00:00:00Z"),
      updatedAt: new Date("2024-02-01T00:00:00Z"),
    };

    const member = CampaignMemberMapper.toDomain(record);

    expect(member.CampaignId).toBe(record.campaignId);
    expect(member.UserId.toString()).toBe(record.userId);
    expect(member.Role).toBe("STORYTELLER");
    expect(member.CreatedAt).toEqual(record.createdAt);
    expect(member.UpdatedAt).toEqual(record.updatedAt);
  });

  it("maps a domain campaign member to a persistence shape", () => {
    const member = CampaignMember.create({
      campaignId: "22222222-2222-2222-2222-222222222222",
      userId: UserId.fromString("33333333-3333-3333-3333-333333333333"),
      role: "PLAYER",
    });

    const record = CampaignMemberMapper.toPersistence(member);

    expect(record).toEqual({
      campaignId: member.CampaignId,
      userId: member.UserId.toString(),
      role: member.Role,
      createdAt: member.CreatedAt,
      updatedAt: member.UpdatedAt,
    });
  });
});
