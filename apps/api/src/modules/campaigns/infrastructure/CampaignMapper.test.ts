import { describe, expect, it } from "vitest";
import { Campaign } from "@storyforge/domain";
import { CampaignMapper, PrismaCampaignWithMembers } from "./CampaignMapper";

describe("CampaignMapper", () => {
  it("maps a persistence record to a domain campaign", () => {
    const record: PrismaCampaignWithMembers = {
      id: "11111111-1111-1111-1111-111111111111",
      name: "My Campaign",
      description: "A tale",
      createdAt: new Date("2024-01-01T00:00:00Z"),
      updatedAt: new Date("2024-02-01T00:00:00Z"),
      archivedAt: null,
      members: [],
    };

    const campaign = CampaignMapper.toDomain(record);

    expect(campaign.Id.toString()).toBe(record.id);
    expect(campaign.Name).toBe(record.name);
    expect(campaign.Description).toBe(record.description);
    expect(campaign.CreatedAt).toEqual(record.createdAt);
    expect(campaign.UpdatedAt).toEqual(record.updatedAt);
    expect(campaign.Members).toEqual([]);
    expect(campaign.Entities).toEqual([]);
  });

  it("hydrates campaign members from the included relation", () => {
    const record: PrismaCampaignWithMembers = {
      id: "11111111-1111-1111-1111-111111111111",
      name: "My Campaign",
      description: "A tale",
      createdAt: new Date("2024-01-01T00:00:00Z"),
      updatedAt: new Date("2024-02-01T00:00:00Z"),
      archivedAt: null,
      members: [
        {
          id: "22222222-2222-2222-2222-222222222222",
          campaignId: "11111111-1111-1111-1111-111111111111",
          userId: "33333333-3333-3333-3333-333333333333",
          role: "OWNER",
          createdAt: new Date("2024-01-01T00:00:00Z"),
          updatedAt: new Date("2024-01-01T00:00:00Z"),
        },
      ],
    };

    const campaign = CampaignMapper.toDomain(record);

    expect(campaign.Members).toHaveLength(1);
    expect(campaign.Members[0].Role).toBe("OWNER");
    expect(campaign.Members[0].UserId.toString()).toBe(
      "33333333-3333-3333-3333-333333333333",
    );
  });

  it("maps a domain campaign to a persistence shape", () => {
    const campaign = Campaign.create({
      name: "My Campaign",
      description: "A tale",
    });

    const record = CampaignMapper.toPersistence(campaign);

    expect(record).toEqual({
      id: campaign.Id.toString(),
      name: "My Campaign",
      description: "A tale",
    });
  });
});
