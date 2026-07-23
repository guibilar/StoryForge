import { describe, expect, it, vi } from "vitest";
import {
  CampaignMember,
  Entity,
  EntityVisibility,
  NotFoundError,
  Relationship,
  RelationshipEndpoint,
  User,
} from "@storyforge/domain";
import { Query } from "./Query";
import type { GraphQLContext } from "../../../../graphql/context";
import type { RelationshipService } from "../../application/RelationshipService";
import type { CampaignMemberService } from "../../../campaignMembers/application/CampaignMemberService";
import type { EntityService } from "../../../entities/application/EntityService";

function makeRelationshipService(): RelationshipService {
  return {
    createRelationship: vi.fn(),
    updateRelationship: vi.fn(),
    deleteRelationship: vi.fn(),
    getRelationship: vi.fn(),
    listRelationshipsByCampaign: vi.fn(),
    listRelationshipsByEntity: vi.fn(),
  } as unknown as RelationshipService;
}

function makeCampaignMemberService(): CampaignMemberService {
  return { getMembership: vi.fn() } as unknown as CampaignMemberService;
}

// A relationship inherits visibility from the entities it connects, so the
// resolver needs the campaign's entity roster to decide what a player sees.
function makeEntityService(
  entities: Entity[] = defaultEntities(),
): EntityService {
  return {
    listEntities: vi.fn().mockResolvedValue(entities),
  } as unknown as EntityService;
}

function makeEntity(id: string, visibility: EntityVisibility): Entity {
  const entity = Entity.create({
    campaignId: "campaign-1",
    type: "Character",
    category: "CHARACTER",
    name: `Entity ${id}`,
    visibility,
  });
  // The fixtures below are keyed by the ids the Relationship fixtures use.
  Object.defineProperty(entity, "Id", {
    value: { toString: () => id },
    configurable: true,
  });
  return entity;
}

function defaultEntities(): Entity[] {
  return [
    makeEntity("entity-1", EntityVisibility.PUBLIC),
    makeEntity("entity-2", EntityVisibility.PUBLIC),
  ];
}

function makeContext(
  relationshipService: RelationshipService,
  campaignMemberService: CampaignMemberService,
  currentUser: User | null,
  entityService: EntityService = makeEntityService(),
): GraphQLContext {
  return {
    relationshipService,
    campaignMemberService,
    entityService,
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

const relationship = Relationship.create({
  campaignId: "campaign-1",
  sourceEntityId: "entity-1",
  targetEntityId: "entity-2",
  type: "ALLY",
});

describe("relationships Query.relationship", () => {
  it("rejects with UNAUTHENTICATED when logged out", async () => {
    const relationshipService = makeRelationshipService();
    const campaignMemberService = makeCampaignMemberService();
    const context = makeContext(
      relationshipService,
      campaignMemberService,
      loggedOutUser,
    );

    await expect(
      Query.relationship(undefined, { id: "relationship-1" }, context),
    ).rejects.toMatchObject({
      extensions: { code: "UNAUTHENTICATED" },
    });
    expect(relationshipService.getRelationship).not.toHaveBeenCalled();
  });

  it("rejects with FORBIDDEN when not a member of the relationship's campaign", async () => {
    const relationshipService = makeRelationshipService();
    const campaignMemberService = makeCampaignMemberService();
    vi.mocked(relationshipService.getRelationship).mockResolvedValue(
      relationship,
    );
    vi.mocked(campaignMemberService.getMembership).mockResolvedValue(null);
    const context = makeContext(
      relationshipService,
      campaignMemberService,
      authenticatedUser,
    );

    await expect(
      Query.relationship(undefined, { id: "relationship-1" }, context),
    ).rejects.toMatchObject({ extensions: { code: "FORBIDDEN" } });
  });

  it("returns the relationship when the user is a campaign member", async () => {
    const relationshipService = makeRelationshipService();
    const campaignMemberService = makeCampaignMemberService();
    vi.mocked(relationshipService.getRelationship).mockResolvedValue(
      relationship,
    );
    vi.mocked(campaignMemberService.getMembership).mockResolvedValue(
      membership,
    );
    const context = makeContext(
      relationshipService,
      campaignMemberService,
      authenticatedUser,
    );

    const result = await Query.relationship(
      undefined,
      { id: "relationship-1" },
      context,
    );

    expect(relationshipService.getRelationship).toHaveBeenCalledWith(
      "relationship-1",
    );
    expect(result).toBe(relationship);
  });

  it("translates domain errors into GraphQL errors", async () => {
    const relationshipService = makeRelationshipService();
    const campaignMemberService = makeCampaignMemberService();
    vi.mocked(relationshipService.getRelationship).mockRejectedValue(
      new NotFoundError("Relationship not found"),
    );
    const context = makeContext(
      relationshipService,
      campaignMemberService,
      authenticatedUser,
    );

    await expect(
      Query.relationship(undefined, { id: "missing" }, context),
    ).rejects.toMatchObject({ extensions: { code: "NOT_FOUND" } });
  });
});

describe("relationships Query.relationships", () => {
  it("rejects with UNAUTHENTICATED when logged out", async () => {
    const relationshipService = makeRelationshipService();
    const campaignMemberService = makeCampaignMemberService();
    const context = makeContext(
      relationshipService,
      campaignMemberService,
      loggedOutUser,
    );

    await expect(
      Query.relationships(undefined, { campaignId: "campaign-1" }, context),
    ).rejects.toMatchObject({
      extensions: { code: "UNAUTHENTICATED" },
    });
    expect(
      relationshipService.listRelationshipsByCampaign,
    ).not.toHaveBeenCalled();
  });

  it("rejects with FORBIDDEN when not a campaign member", async () => {
    const relationshipService = makeRelationshipService();
    const campaignMemberService = makeCampaignMemberService();
    vi.mocked(campaignMemberService.getMembership).mockResolvedValue(null);
    const context = makeContext(
      relationshipService,
      campaignMemberService,
      authenticatedUser,
    );

    await expect(
      Query.relationships(undefined, { campaignId: "campaign-1" }, context),
    ).rejects.toMatchObject({ extensions: { code: "FORBIDDEN" } });
    expect(
      relationshipService.listRelationshipsByCampaign,
    ).not.toHaveBeenCalled();
  });

  it("delegates to listRelationshipsByCampaign when no entityId is given", async () => {
    const relationshipService = makeRelationshipService();
    const campaignMemberService = makeCampaignMemberService();
    vi.mocked(campaignMemberService.getMembership).mockResolvedValue(
      membership,
    );
    vi.mocked(
      relationshipService.listRelationshipsByCampaign,
    ).mockResolvedValue([relationship]);
    const context = makeContext(
      relationshipService,
      campaignMemberService,
      authenticatedUser,
    );

    const result = await Query.relationships(
      undefined,
      { campaignId: "campaign-1" },
      context,
    );

    expect(
      relationshipService.listRelationshipsByCampaign,
    ).toHaveBeenCalledWith("campaign-1");
    expect(
      relationshipService.listRelationshipsByEntity,
    ).not.toHaveBeenCalled();
    expect(result).toEqual([relationship]);
  });

  it("delegates to listRelationshipsByEntity when entityId is given", async () => {
    const relationshipService = makeRelationshipService();
    const campaignMemberService = makeCampaignMemberService();
    vi.mocked(campaignMemberService.getMembership).mockResolvedValue(
      membership,
    );
    vi.mocked(relationshipService.listRelationshipsByEntity).mockResolvedValue([
      relationship,
    ]);
    const context = makeContext(
      relationshipService,
      campaignMemberService,
      authenticatedUser,
    );

    const result = await Query.relationships(
      undefined,
      { campaignId: "campaign-1", entityId: "entity-1" },
      context,
    );

    expect(relationshipService.listRelationshipsByEntity).toHaveBeenCalledWith(
      "campaign-1",
      "entity-1",
    );
    expect(
      relationshipService.listRelationshipsByCampaign,
    ).not.toHaveBeenCalled();
    expect(result).toEqual([relationship]);
  });
});

describe("relationship visibility derives from its endpoints", () => {
  const hiddenEndpointEntities = [
    makeEntity("entity-1", EntityVisibility.PUBLIC),
    makeEntity("entity-2", EntityVisibility.STORYTELLER),
  ];

  function setup(
    role: "PLAYER" | "OBSERVER" | "STORYTELLER",
    entities: Entity[],
  ) {
    const relationshipService = makeRelationshipService();
    const campaignMemberService = makeCampaignMemberService();
    vi.mocked(campaignMemberService.getMembership).mockResolvedValue(
      CampaignMember.create({
        campaignId: "campaign-1",
        userId: authenticatedUser.Id,
        role,
      }),
    );
    const context = makeContext(
      relationshipService,
      campaignMemberService,
      authenticatedUser,
      makeEntityService(entities),
    );
    return { relationshipService, context };
  }

  it("hides a relationship whose other end a player cannot see", async () => {
    const { relationshipService, context } = setup(
      "PLAYER",
      hiddenEndpointEntities,
    );
    vi.mocked(
      relationshipService.listRelationshipsByCampaign,
    ).mockResolvedValue([relationship]);

    const result = await Query.relationships(
      undefined,
      { campaignId: "campaign-1" },
      context,
    );

    // The type and (spoiler-carrying) description must not reach a player
    // who was never shown the entity on the other end.
    expect(result).toEqual([]);
  });

  it("hides it from an observer too", async () => {
    const { relationshipService, context } = setup(
      "OBSERVER",
      hiddenEndpointEntities,
    );
    vi.mocked(
      relationshipService.listRelationshipsByCampaign,
    ).mockResolvedValue([relationship]);

    const result = await Query.relationships(
      undefined,
      { campaignId: "campaign-1" },
      context,
    );

    expect(result).toEqual([]);
  });

  it("keeps a relationship between two entities the player can see", async () => {
    const { relationshipService, context } = setup("PLAYER", defaultEntities());
    vi.mocked(
      relationshipService.listRelationshipsByCampaign,
    ).mockResolvedValue([relationship]);

    const result = await Query.relationships(
      undefined,
      { campaignId: "campaign-1" },
      context,
    );

    expect(result).toEqual([relationship]);
  });

  it("still shows a Storyteller every relationship, without a roster lookup", async () => {
    const { relationshipService, context } = setup(
      "STORYTELLER",
      hiddenEndpointEntities,
    );
    vi.mocked(
      relationshipService.listRelationshipsByCampaign,
    ).mockResolvedValue([relationship]);

    const result = await Query.relationships(
      undefined,
      { campaignId: "campaign-1" },
      context,
    );

    expect(result).toEqual([relationship]);
    expect(context.entityService.listEntities).not.toHaveBeenCalled();
  });

  it("applies the same rule to the entity-scoped list", async () => {
    const { relationshipService, context } = setup(
      "PLAYER",
      hiddenEndpointEntities,
    );
    vi.mocked(relationshipService.listRelationshipsByEntity).mockResolvedValue([
      relationship,
    ]);

    const result = await Query.relationships(
      undefined,
      { campaignId: "campaign-1", entityId: "entity-1" },
      context,
    );

    expect(result).toEqual([]);
  });

  it("rejects fetching a hidden relationship by id", async () => {
    const { relationshipService, context } = setup(
      "PLAYER",
      hiddenEndpointEntities,
    );
    vi.mocked(relationshipService.getRelationship).mockResolvedValue(
      relationship,
    );

    await expect(
      Query.relationship(undefined, { id: "relationship-1" }, context),
    ).rejects.toMatchObject({ extensions: { code: "FORBIDDEN" } });
  });
});

describe("a concealed endpoint's own entity visibility no longer gates the row", () => {
  const concealedTargetRelationship = Relationship.create({
    campaignId: "campaign-1",
    sourceEntityId: "entity-1",
    targetEntityId: "entity-2",
    type: "BLACKMAILS",
    concealedEndpoint: RelationshipEndpoint.TARGET,
  });

  function setup(role: "PLAYER" | "STORYTELLER") {
    const relationshipService = makeRelationshipService();
    const campaignMemberService = makeCampaignMemberService();
    vi.mocked(campaignMemberService.getMembership).mockResolvedValue(
      CampaignMember.create({
        campaignId: "campaign-1",
        userId: authenticatedUser.Id,
        role,
      }),
    );
    const context = makeContext(
      relationshipService,
      campaignMemberService,
      authenticatedUser,
      // The concealed side (entity-2) is STORYTELLER-only — under the old
      // all-or-nothing rule this would drop the whole relationship for a
      // player; concealment is what's supposed to keep it visible instead.
      makeEntityService([
        makeEntity("entity-1", EntityVisibility.PUBLIC),
        makeEntity("entity-2", EntityVisibility.STORYTELLER),
      ]),
    );
    return { relationshipService, context };
  }

  it("keeps the relationship visible to a player instead of dropping it", async () => {
    const { relationshipService, context } = setup("PLAYER");
    vi.mocked(
      relationshipService.listRelationshipsByCampaign,
    ).mockResolvedValue([concealedTargetRelationship]);

    const result = await Query.relationships(
      undefined,
      { campaignId: "campaign-1" },
      context,
    );

    expect(result).toEqual([concealedTargetRelationship]);
  });

  it("still hides a relationship whose concealed side is SOURCE but the real target is invisible", async () => {
    // Concealment only excuses the concealed side's own visibility check —
    // an *unconcealed* endpoint the viewer can't see still filters the row.
    const concealedSourceRelationship = Relationship.create({
      campaignId: "campaign-1",
      sourceEntityId: "entity-1",
      targetEntityId: "entity-2",
      type: "BLACKMAILS",
      concealedEndpoint: RelationshipEndpoint.SOURCE,
    });
    const { relationshipService, context } = setup("PLAYER");
    vi.mocked(
      relationshipService.listRelationshipsByCampaign,
    ).mockResolvedValue([concealedSourceRelationship]);

    const result = await Query.relationships(
      undefined,
      { campaignId: "campaign-1" },
      context,
    );

    expect(result).toEqual([]);
  });
});
