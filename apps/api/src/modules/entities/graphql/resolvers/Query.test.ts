import { describe, expect, it, vi } from "vitest";
import {
  CampaignMember,
  Entity,
  EntityVisibility,
  NotFoundError,
  User,
} from "@storyforge/domain";
import { Query } from "./Query";
import type { GraphQLContext } from "../../../../graphql/context";
import type { EntityService } from "../../application/EntityService";
import type { CampaignMemberService } from "../../../campaignMembers/application/CampaignMemberService";

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
  entityService: EntityService,
  campaignMemberService: CampaignMemberService,
  currentUser: User | null,
): GraphQLContext {
  return {
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
  role: "PLAYER",
});

describe("entities Query.entity", () => {
  it("rejects with UNAUTHENTICATED when logged out", async () => {
    const entityService = makeEntityService();
    const campaignMemberService = makeCampaignMemberService();
    const context = makeContext(
      entityService,
      campaignMemberService,
      loggedOutUser,
    );

    await expect(
      Query.entity(undefined, { id: "entity-1" }, context),
    ).rejects.toMatchObject({
      extensions: { code: "UNAUTHENTICATED" },
    });
    expect(entityService.getEntity).not.toHaveBeenCalled();
  });

  it("rejects with FORBIDDEN when not a member of the entity's campaign", async () => {
    const entityService = makeEntityService();
    const campaignMemberService = makeCampaignMemberService();
    const entity = Entity.create({
      campaignId: "campaign-1",
      type: "npc",
      name: "Goblin",
      visibility: EntityVisibility.PUBLIC,
    });
    vi.mocked(entityService.getEntity).mockResolvedValue(entity);
    vi.mocked(campaignMemberService.getMembership).mockResolvedValue(null);
    const context = makeContext(
      entityService,
      campaignMemberService,
      authenticatedUser,
    );

    await expect(
      Query.entity(undefined, { id: "entity-1" }, context),
    ).rejects.toMatchObject({ extensions: { code: "FORBIDDEN" } });
  });

  it("returns the entity when the user is a campaign member", async () => {
    const entityService = makeEntityService();
    const campaignMemberService = makeCampaignMemberService();
    const entity = Entity.create({
      campaignId: "campaign-1",
      type: "npc",
      name: "Goblin",
      visibility: EntityVisibility.PUBLIC,
    });
    vi.mocked(entityService.getEntity).mockResolvedValue(entity);
    vi.mocked(campaignMemberService.getMembership).mockResolvedValue(
      membership,
    );
    const context = makeContext(
      entityService,
      campaignMemberService,
      authenticatedUser,
    );

    const result = await Query.entity(undefined, { id: "entity-1" }, context);

    expect(entityService.getEntity).toHaveBeenCalledWith("entity-1");
    expect(result).toBe(entity);
  });

  it("translates domain errors into GraphQL errors", async () => {
    const entityService = makeEntityService();
    const campaignMemberService = makeCampaignMemberService();
    vi.mocked(entityService.getEntity).mockRejectedValue(
      new NotFoundError("Entity not found"),
    );
    const context = makeContext(
      entityService,
      campaignMemberService,
      authenticatedUser,
    );

    await expect(
      Query.entity(undefined, { id: "missing" }, context),
    ).rejects.toMatchObject({ extensions: { code: "NOT_FOUND" } });
  });
});

describe("entities Query.entities", () => {
  it("rejects with UNAUTHENTICATED when logged out", async () => {
    const entityService = makeEntityService();
    const campaignMemberService = makeCampaignMemberService();
    const context = makeContext(
      entityService,
      campaignMemberService,
      loggedOutUser,
    );

    await expect(
      Query.entities(undefined, { campaignId: "campaign-1" }, context),
    ).rejects.toMatchObject({
      extensions: { code: "UNAUTHENTICATED" },
    });
    expect(entityService.listEntities).not.toHaveBeenCalled();
  });

  it("rejects with FORBIDDEN when not a campaign member", async () => {
    const entityService = makeEntityService();
    const campaignMemberService = makeCampaignMemberService();
    vi.mocked(campaignMemberService.getMembership).mockResolvedValue(null);
    const context = makeContext(
      entityService,
      campaignMemberService,
      authenticatedUser,
    );

    await expect(
      Query.entities(undefined, { campaignId: "campaign-1" }, context),
    ).rejects.toMatchObject({ extensions: { code: "FORBIDDEN" } });
    expect(entityService.listEntities).not.toHaveBeenCalled();
  });

  it("delegates to the service without a filter", async () => {
    const entityService = makeEntityService();
    const campaignMemberService = makeCampaignMemberService();
    vi.mocked(campaignMemberService.getMembership).mockResolvedValue(
      membership,
    );
    const entities = [
      Entity.create({
        campaignId: "campaign-1",
        type: "npc",
        name: "Goblin",
        visibility: EntityVisibility.PUBLIC,
      }),
    ];
    vi.mocked(entityService.listEntities).mockResolvedValue(entities);
    const context = makeContext(
      entityService,
      campaignMemberService,
      authenticatedUser,
    );

    const result = await Query.entities(
      undefined,
      { campaignId: "campaign-1" },
      context,
    );

    expect(entityService.listEntities).toHaveBeenCalledWith(
      "campaign-1",
      undefined,
    );
    expect(result).toBe(entities);
  });

  it("passes the filter through to the service unchanged", async () => {
    const entityService = makeEntityService();
    const campaignMemberService = makeCampaignMemberService();
    vi.mocked(campaignMemberService.getMembership).mockResolvedValue(
      membership,
    );
    vi.mocked(entityService.listEntities).mockResolvedValue([]);
    const context = makeContext(
      entityService,
      campaignMemberService,
      authenticatedUser,
    );
    const filter = { type: "npc", nameContains: "gob", tagIds: ["tag-1"] };

    await Query.entities(
      undefined,
      { campaignId: "campaign-1", filter },
      context,
    );

    expect(entityService.listEntities).toHaveBeenCalledWith(
      "campaign-1",
      filter,
    );
  });
});
