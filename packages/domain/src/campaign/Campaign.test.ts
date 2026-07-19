import { describe, expect, it } from "vitest";
import { Campaign } from "./Campaign";
import { CampaignId } from "./CampaignId";
import { CampaignMember } from "../campaignMember";
import { Entity } from "../entity";
import { EntityCategory, EntityVisibility } from "../entity";
import { UserId } from "../user";
import { ValidationError } from "../shared";

const validProps = { name: "My Campaign", description: "A tale" };

function makeMember() {
  return CampaignMember.create({
    campaignId: "campaign-1",
    userId: UserId.create(),
    role: "PLAYER",
  });
}

function makeEntity() {
  return Entity.create({
    campaignId: "campaign-1",
    type: "npc",
    category: EntityCategory.CHARACTER,
    name: "Goblin",
    visibility: EntityVisibility.PUBLIC,
  });
}

describe("Campaign", () => {
  it("creates a campaign with defaults", () => {
    const campaign = Campaign.create(validProps);

    expect(campaign.Name).toBe(validProps.name);
    expect(campaign.Description).toBe(validProps.description);
    expect(campaign.ArchivedAt).toBeNull();
    expect(campaign.Members).toEqual([]);
    expect(campaign.Entities).toEqual([]);
  });

  it("defaults description to null when omitted", () => {
    const campaign = Campaign.create({ name: "No description" });

    expect(campaign.Description).toBeNull();
  });

  it("rehydrates preserving id and timestamps", () => {
    const id = CampaignId.create();
    const createdAt = new Date("2024-01-01T00:00:00Z");
    const updatedAt = new Date("2024-02-01T00:00:00Z");

    const campaign = Campaign.rehydrate({
      id,
      name: validProps.name,
      description: null,
      createdAt,
      updatedAt,
      archivedAt: null,
      campaignMembers: [],
      entities: [],
    });

    expect(campaign.Id.equals(id)).toBe(true);
    expect(campaign.CreatedAt).toBe(createdAt);
    expect(campaign.UpdatedAt).toBe(updatedAt);
  });

  it.each(["", "   "])("rejects an empty name %j", (name) => {
    expect(() => Campaign.create({ ...validProps, name })).toThrow(
      "Campaign name cannot be empty.",
    );
  });

  it("rejects a name longer than 255 characters", () => {
    expect(() =>
      Campaign.create({ ...validProps, name: "a".repeat(256) }),
    ).toThrow("Campaign name cannot exceed 255 characters.");
  });

  it("rejects a description longer than 1000 characters", () => {
    expect(() =>
      Campaign.create({ ...validProps, description: "a".repeat(1001) }),
    ).toThrow("Campaign description cannot exceed 1000 characters.");
  });

  it("trims the name on rename", () => {
    const campaign = Campaign.create(validProps);

    campaign.rename("  New Name  ");

    expect(campaign.Name).toBe("New Name");
  });

  it("rejects renaming to an empty name", () => {
    const campaign = Campaign.create(validProps);

    expect(() => campaign.rename("   ")).toThrow(ValidationError);
  });

  it("archives an active campaign", () => {
    const campaign = Campaign.create(validProps);

    campaign.archive();

    expect(campaign.ArchivedAt).toBeInstanceOf(Date);
  });

  it("rejects archiving an already archived campaign", () => {
    const campaign = Campaign.create(validProps);
    campaign.archive();

    expect(() => campaign.archive()).toThrow("Campaign is already archived.");
  });

  it("adds a member", () => {
    const campaign = Campaign.create(validProps);
    const member = makeMember();

    campaign.addMember(member);

    expect(campaign.Members).toHaveLength(1);
    expect(campaign.Members[0]?.UserId.equals(member.UserId)).toBe(true);
  });

  it("rejects adding a duplicate member", () => {
    const campaign = Campaign.create(validProps);
    const member = makeMember();
    campaign.addMember(member);

    expect(() => campaign.addMember(member)).toThrow(
      `User with ID ${member.UserId.toString()} is already a member of the campaign.`,
    );
  });

  it("removes a member", () => {
    const campaign = Campaign.create(validProps);
    const member = makeMember();
    campaign.addMember(member);

    campaign.removeMember(member.UserId);

    expect(campaign.Members).toHaveLength(0);
  });

  it("rejects removing a member that does not exist", () => {
    const campaign = Campaign.create(validProps);
    const userId = UserId.create();

    expect(() => campaign.removeMember(userId)).toThrow(
      `User with ID ${userId.toString()} is not a member of the campaign.`,
    );
  });

  it("Members returns a defensive copy", () => {
    const campaign = Campaign.create(validProps);
    campaign.addMember(makeMember());

    campaign.Members.pop();

    expect(campaign.Members).toHaveLength(1);
  });

  it("adds an entity", () => {
    const campaign = Campaign.create(validProps);
    const entity = makeEntity();

    campaign.addEntity(entity);

    expect(campaign.Entities).toHaveLength(1);
  });

  it("rejects adding a duplicate entity", () => {
    const campaign = Campaign.create(validProps);
    const entity = makeEntity();
    campaign.addEntity(entity);

    expect(() => campaign.addEntity(entity)).toThrow(
      `Entity with ID ${entity.Id.toString()} already exists in the campaign.`,
    );
  });

  it("removes an entity", () => {
    const campaign = Campaign.create(validProps);
    const entity = makeEntity();
    campaign.addEntity(entity);

    campaign.removeEntity(entity.Id);

    expect(campaign.Entities).toHaveLength(0);
  });

  it("rejects removing an entity that does not exist", () => {
    const campaign = Campaign.create(validProps);
    const entity = makeEntity();

    expect(() => campaign.removeEntity(entity.Id)).toThrow(
      `Entity with ID ${entity.Id.toString()} does not exist in the campaign.`,
    );
  });
});
