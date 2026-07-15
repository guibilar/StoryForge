import { describe, expect, it, vi } from "vitest";
import { Entity, EntityVisibility, User } from "@storyforge/domain";
import { Mutation } from "./Mutation";
import type { GraphQLContext } from "../../../../graphql/context";
import type { TagService } from "../../application/TagService";

function makeTagService(): TagService {
  return {
    listCampaignTags: vi.fn(),
    listEntityTags: vi.fn(),
    addTagToEntity: vi.fn(),
    removeTagFromEntity: vi.fn(),
  } as unknown as TagService;
}

function makeContext(
  tagService: TagService,
  currentUser: User | null,
): GraphQLContext {
  return { tagService, currentUser } as GraphQLContext;
}

const loggedOutUser = null;
const authenticatedUser = User.create({
  email: "user@example.com",
  password: "hashed",
});

const entity = Entity.create({
  campaignId: "campaign-1",
  type: "npc",
  name: "Goblin",
  visibility: EntityVisibility.PUBLIC,
});

describe("tags Mutation.addTagToEntity", () => {
  it("rejects with UNAUTHENTICATED when logged out", async () => {
    const tagService = makeTagService();
    const context = makeContext(tagService, loggedOutUser);

    await expect(
      Mutation.addTagToEntity(
        undefined,
        { entityId: "entity-1", name: "villain" },
        context,
      ),
    ).rejects.toMatchObject({
      extensions: { code: "UNAUTHENTICATED" },
    });
    expect(tagService.addTagToEntity).not.toHaveBeenCalled();
  });

  it("delegates to tagService when authenticated", async () => {
    const tagService = makeTagService();
    vi.mocked(tagService.addTagToEntity).mockResolvedValue(entity);
    const context = makeContext(tagService, authenticatedUser);

    const result = await Mutation.addTagToEntity(
      undefined,
      { entityId: "entity-1", name: "villain" },
      context,
    );

    expect(tagService.addTagToEntity).toHaveBeenCalledWith(
      "entity-1",
      "villain",
    );
    expect(result).toBe(entity);
  });
});

describe("tags Mutation.removeTagFromEntity", () => {
  it("rejects with UNAUTHENTICATED when logged out", async () => {
    const tagService = makeTagService();
    const context = makeContext(tagService, loggedOutUser);

    await expect(
      Mutation.removeTagFromEntity(
        undefined,
        { entityId: "entity-1", tagId: "tag-1" },
        context,
      ),
    ).rejects.toMatchObject({
      extensions: { code: "UNAUTHENTICATED" },
    });
    expect(tagService.removeTagFromEntity).not.toHaveBeenCalled();
  });

  it("delegates to tagService when authenticated", async () => {
    const tagService = makeTagService();
    vi.mocked(tagService.removeTagFromEntity).mockResolvedValue(entity);
    const context = makeContext(tagService, authenticatedUser);

    const result = await Mutation.removeTagFromEntity(
      undefined,
      { entityId: "entity-1", tagId: "tag-1" },
      context,
    );

    expect(tagService.removeTagFromEntity).toHaveBeenCalledWith(
      "entity-1",
      "tag-1",
    );
    expect(result).toBe(entity);
  });
});
