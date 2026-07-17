import { describe, expect, it, vi } from "vitest";
import {
  CampaignMember,
  Entity,
  EntityVisibility,
  User,
} from "@storyforge/domain";
import { Mutation } from "./Mutation";
import type { GraphQLContext } from "../../../../graphql/context";
import type { TagService } from "../../application/TagService";
import type { EntityService } from "../../../entities/application/EntityService";
import type { CampaignMemberService } from "../../../campaignMembers/application/CampaignMemberService";

function makeTagService(): TagService {
  return {
    listCampaignTags: vi.fn(),
    listEntityTags: vi.fn(),
    addTagToEntity: vi.fn(),
    removeTagFromEntity: vi.fn(),
  } as unknown as TagService;
}

function makeEntityService(): EntityService {
  return {
    createEntity: vi.fn(),
    updateEntity: vi.fn(),
    deleteEntity: vi.fn(),
    getEntity: vi.fn(),
    setEntityImage: vi.fn(),
    listEntities: vi.fn(),
  } as unknown as EntityService;
}

function makeCampaignMemberService(): CampaignMemberService {
  return { getMembership: vi.fn() } as unknown as CampaignMemberService;
}

function makeContext(
  tagService: TagService,
  entityService: EntityService,
  campaignMemberService: CampaignMemberService,
  currentUser: User | null,
): GraphQLContext {
  return {
    tagService,
    entityService,
    campaignMemberService,
    currentUser,
  } as GraphQLContext;
}

const loggedOutUser = null;
const authenticatedUser = User.create({
  email: "user@example.com",
  password: "hashed",
});

const membership = CampaignMember.create({
  campaignId: "campaign-1",
  userId: authenticatedUser.Id,
  role: "STORYTELLER",
});

const playerMembership = CampaignMember.create({
  campaignId: "campaign-1",
  userId: authenticatedUser.Id,
  role: "PLAYER",
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
    const entityService = makeEntityService();
    const campaignMemberService = makeCampaignMemberService();
    const context = makeContext(
      tagService,
      entityService,
      campaignMemberService,
      loggedOutUser,
    );

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

  it("rejects with FORBIDDEN when not a member of the entity's campaign", async () => {
    const tagService = makeTagService();
    const entityService = makeEntityService();
    const campaignMemberService = makeCampaignMemberService();
    vi.mocked(entityService.getEntity).mockResolvedValue(entity);
    vi.mocked(campaignMemberService.getMembership).mockResolvedValue(null);
    const context = makeContext(
      tagService,
      entityService,
      campaignMemberService,
      authenticatedUser,
    );

    await expect(
      Mutation.addTagToEntity(
        undefined,
        { entityId: "entity-1", name: "villain" },
        context,
      ),
    ).rejects.toMatchObject({ extensions: { code: "FORBIDDEN" } });
    expect(tagService.addTagToEntity).not.toHaveBeenCalled();
  });

  it("rejects with FORBIDDEN when the member's role cannot write", async () => {
    const tagService = makeTagService();
    const entityService = makeEntityService();
    const campaignMemberService = makeCampaignMemberService();
    vi.mocked(entityService.getEntity).mockResolvedValue(entity);
    vi.mocked(campaignMemberService.getMembership).mockResolvedValue(
      playerMembership,
    );
    const context = makeContext(
      tagService,
      entityService,
      campaignMemberService,
      authenticatedUser,
    );

    await expect(
      Mutation.addTagToEntity(
        undefined,
        { entityId: "entity-1", name: "villain" },
        context,
      ),
    ).rejects.toMatchObject({ extensions: { code: "FORBIDDEN" } });
    expect(tagService.addTagToEntity).not.toHaveBeenCalled();
  });

  it("delegates to tagService when the user is a campaign member", async () => {
    const tagService = makeTagService();
    const entityService = makeEntityService();
    const campaignMemberService = makeCampaignMemberService();
    vi.mocked(entityService.getEntity).mockResolvedValue(entity);
    vi.mocked(campaignMemberService.getMembership).mockResolvedValue(
      membership,
    );
    vi.mocked(tagService.addTagToEntity).mockResolvedValue(entity);
    const context = makeContext(
      tagService,
      entityService,
      campaignMemberService,
      authenticatedUser,
    );

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
    const entityService = makeEntityService();
    const campaignMemberService = makeCampaignMemberService();
    const context = makeContext(
      tagService,
      entityService,
      campaignMemberService,
      loggedOutUser,
    );

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

  it("rejects with FORBIDDEN when not a member of the entity's campaign", async () => {
    const tagService = makeTagService();
    const entityService = makeEntityService();
    const campaignMemberService = makeCampaignMemberService();
    vi.mocked(entityService.getEntity).mockResolvedValue(entity);
    vi.mocked(campaignMemberService.getMembership).mockResolvedValue(null);
    const context = makeContext(
      tagService,
      entityService,
      campaignMemberService,
      authenticatedUser,
    );

    await expect(
      Mutation.removeTagFromEntity(
        undefined,
        { entityId: "entity-1", tagId: "tag-1" },
        context,
      ),
    ).rejects.toMatchObject({ extensions: { code: "FORBIDDEN" } });
    expect(tagService.removeTagFromEntity).not.toHaveBeenCalled();
  });

  it("delegates to tagService when the user is a campaign member", async () => {
    const tagService = makeTagService();
    const entityService = makeEntityService();
    const campaignMemberService = makeCampaignMemberService();
    vi.mocked(entityService.getEntity).mockResolvedValue(entity);
    vi.mocked(campaignMemberService.getMembership).mockResolvedValue(
      membership,
    );
    vi.mocked(tagService.removeTagFromEntity).mockResolvedValue(entity);
    const context = makeContext(
      tagService,
      entityService,
      campaignMemberService,
      authenticatedUser,
    );

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
