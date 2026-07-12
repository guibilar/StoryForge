import { describe, expect, it } from "vitest";
import { Tag } from "./Tag";
import { TagId } from "./TagId";

const validProps = {
  campaignId: "campaign-1",
  name: "Faction:Thieves-Guild",
};

describe("Tag", () => {
  it("creates a tag with a normalized name", () => {
    const tag = Tag.create(validProps);

    expect(tag.CampaignId).toBe(validProps.campaignId);
    expect(tag.Name).toBe("faction:thieves-guild");
  });

  it("rehydrates preserving id and timestamps", () => {
    const id = TagId.create();
    const createdAt = new Date("2024-01-01T00:00:00Z");
    const updatedAt = new Date("2024-02-01T00:00:00Z");

    const tag = Tag.rehydrate({
      id,
      campaignId: validProps.campaignId,
      name: "status:dead",
      createdAt,
      updatedAt,
    });

    expect(tag.Id.equals(id)).toBe(true);
    expect(tag.CreatedAt).toBe(createdAt);
    expect(tag.UpdatedAt).toBe(updatedAt);
  });

  it.each(["", "   "])("rejects an empty name %j", (name) => {
    expect(() => Tag.create({ ...validProps, name })).toThrow(
      "Tag name cannot be empty.",
    );
  });

  it("rejects a name longer than 255 characters", () => {
    expect(() => Tag.create({ ...validProps, name: "a".repeat(256) })).toThrow(
      "Tag name cannot exceed 255 characters.",
    );
  });

  it("normalizes casing and whitespace on rename", () => {
    const tag = Tag.create(validProps);

    tag.rename("  New Tag  ");

    expect(tag.Name).toBe("new tag");
  });
});
