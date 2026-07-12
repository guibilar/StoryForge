import { describe, expect, it } from "vitest";
import { Tag } from "@storyforge/domain";
import type { Tag as PrismaTag } from "@storyforge/database";
import { TagMapper } from "./TagMapper";

describe("TagMapper", () => {
  it("maps a persistence record to a domain tag", () => {
    const record: PrismaTag = {
      id: "11111111-1111-1111-1111-111111111111",
      campaignId: "22222222-2222-2222-2222-222222222222",
      name: "faction:thieves-guild",
      createdAt: new Date("2024-01-01T00:00:00Z"),
      updatedAt: new Date("2024-02-01T00:00:00Z"),
    };

    const tag = TagMapper.toDomain(record);

    expect(tag.Id.toString()).toBe(record.id);
    expect(tag.CampaignId).toBe(record.campaignId);
    expect(tag.Name).toBe(record.name);
    expect(tag.CreatedAt).toEqual(record.createdAt);
    expect(tag.UpdatedAt).toEqual(record.updatedAt);
  });

  it("maps a domain tag to a persistence shape", () => {
    const tag = Tag.create({
      campaignId: "22222222-2222-2222-2222-222222222222",
      name: "status:dead",
    });

    const record = TagMapper.toPersistence(tag);

    expect(record).toEqual({
      id: tag.Id.toString(),
      campaignId: tag.CampaignId,
      name: tag.Name,
      createdAt: tag.CreatedAt,
      updatedAt: tag.UpdatedAt,
    });
  });
});
