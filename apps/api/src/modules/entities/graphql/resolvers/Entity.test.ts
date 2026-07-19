import { describe, expect, it, vi } from "vitest";
import {
  Entity as DomainEntity,
  EntityCategory,
  EntityVisibility,
} from "@storyforge/domain";
import { Entity } from "./Entity";
import type { GraphQLContext } from "../../../../graphql/context";

// GraphQL's default field resolver reads `source[fieldName]` — since
// DomainEntity only exposes capitalized getters (entity.Category, not
// entity.category), any field without an explicit resolver here silently
// resolves to undefined and GraphQL errors on the non-null field ("Cannot
// return null for non-nullable field"), masked as "Unexpected error." by
// graphql-yoga. category/isPlayerCharacter were missing resolvers entirely
// until this fix — this file exists to make that class of bug loud in CI
// instead of only in production traffic.
function makeEntity() {
  return DomainEntity.create({
    campaignId: "campaign-1",
    type: "Vampire",
    category: EntityCategory.CHARACTER,
    name: "Lucien",
    visibility: EntityVisibility.PUBLIC,
    isPlayerCharacter: true,
  });
}

describe("Entity resolver", () => {
  it("resolves every scalar field via the domain entity's getters", () => {
    const entity = makeEntity();

    expect(Entity.id(entity)).toBe(entity.Id.toString());
    expect(Entity.campaignId(entity)).toBe(entity.CampaignId);
    expect(Entity.type(entity)).toBe(entity.Type);
    expect(Entity.category(entity)).toBe(EntityCategory.CHARACTER);
    expect(Entity.name(entity)).toBe(entity.Name);
    expect(Entity.visibility(entity)).toBe(EntityVisibility.PUBLIC);
    expect(Entity.isPlayerCharacter(entity)).toBe(true);
    expect(Entity.createdAt(entity)).toBe(entity.CreatedAt.toISOString());
    expect(Entity.updatedAt(entity)).toBe(entity.UpdatedAt.toISOString());
    expect(Entity.deletedAt(entity)).toBeNull();
  });

  it("resolves tags via the tag service", async () => {
    const entity = makeEntity();
    const listEntityTags = vi.fn().mockResolvedValue([]);
    const context = {
      tagService: { listEntityTags },
    } as unknown as GraphQLContext;

    await Entity.tags(entity, {}, context);

    expect(listEntityTags).toHaveBeenCalledWith(entity.Id.toString());
  });

  it("resolves ownerMember via the campaign member service when an owner is linked", async () => {
    const entity = makeEntity();
    entity.linkOwner("user-1");
    const getMembership = vi.fn().mockResolvedValue({ userId: "user-1" });
    const context = {
      campaignMemberService: { getMembership },
    } as unknown as GraphQLContext;

    await Entity.ownerMember(entity, {}, context);

    expect(getMembership).toHaveBeenCalledWith(entity.CampaignId, "user-1");
    expect(Entity.ownerUserId(entity)).toBe("user-1");
  });

  it("resolves ownerMember to null when no owner is linked", async () => {
    const entity = makeEntity();
    const getMembership = vi.fn();
    const context = {
      campaignMemberService: { getMembership },
    } as unknown as GraphQLContext;

    const result = await Entity.ownerMember(entity, {}, context);

    expect(result).toBeNull();
    expect(getMembership).not.toHaveBeenCalled();
    expect(Entity.ownerUserId(entity)).toBeNull();
  });
});
