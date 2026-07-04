import { describe, expect, it } from "vitest";
import { Campaign } from "@storyforge/domain";
import type { Campaign as PrismaCampaign } from "@storyforge/database";
import { CampaignMapper } from "./CampaignMapper";

describe("CampaignMapper", () => {
  it("maps a persistence record to a domain campaign", () => {
    const record: PrismaCampaign = {
      id: "11111111-1111-1111-1111-111111111111",
      name: "My Campaign",
      description: "A tale",
      createdAt: new Date("2024-01-01T00:00:00Z"),
      updatedAt: new Date("2024-02-01T00:00:00Z"),
      archivedAt: null,
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
