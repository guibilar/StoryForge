import { describe, expect, it, vi } from "vitest";
import {
  CampaignMember,
  Entity,
  EntityVisibility,
  User,
} from "@storyforge/domain";
import { Mutation, resolveForceOpenTargetUserIds } from "./Mutation";
import type { GraphQLContext } from "../../../../graphql/context";
import type { EntityService } from "../../application/EntityService";
import type { LocalImageStore } from "../../infrastructure/LocalImageStore";
import type { CampaignMemberService } from "../../../campaignMembers/application/CampaignMemberService";
import type { PubSub } from "../../../../graphql/pubsub";

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

function makeImageStorage(): LocalImageStore {
  return { save: vi.fn() } as unknown as LocalImageStore;
}

function makeCampaignMemberService(): CampaignMemberService {
  return {
    getMembership: vi.fn(),
    listMembers: vi.fn(),
  } as unknown as CampaignMemberService;
}

function makePubSub(): PubSub {
  return { publish: vi.fn(), subscribe: vi.fn() } as unknown as PubSub;
}

function makeContext(
  entityService: EntityService,
  imageStorage: LocalImageStore,
  campaignMemberService: CampaignMemberService,
  currentUser: User | null,
  pubSub: PubSub = makePubSub(),
): GraphQLContext {
  return {
    entityService,
    imageStorage,
    campaignMemberService,
    currentUser,
    pubSub,
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

const coStorytellerMembership = CampaignMember.create({
  campaignId: "campaign-1",
  userId: authenticatedUser.Id,
  role: "CO_STORYTELLER",
});

const observerMembership = CampaignMember.create({
  campaignId: "campaign-1",
  userId: authenticatedUser.Id,
  role: "OBSERVER",
});

const file = {
  name: "portrait.png",
  type: "image/png",
  arrayBuffer: async () => new ArrayBuffer(8),
} as File;

describe("entities Mutation.createEntity", () => {
  it("rejects with UNAUTHENTICATED when logged out", async () => {
    const entityService = makeEntityService();
    const imageStorage = makeImageStorage();
    const campaignMemberService = makeCampaignMemberService();
    const context = makeContext(
      entityService,
      imageStorage,
      campaignMemberService,
      loggedOutUser,
    );
    const input = {
      campaignId: "campaign-1",
      type: "npc",
      name: "Goblin",
      visibility: EntityVisibility.PUBLIC,
    };

    await expect(
      Mutation.createEntity(undefined, { input }, context),
    ).rejects.toMatchObject({
      extensions: { code: "UNAUTHENTICATED" },
    });
    expect(entityService.createEntity).not.toHaveBeenCalled();
  });

  it("rejects with FORBIDDEN when not a campaign member", async () => {
    const entityService = makeEntityService();
    const imageStorage = makeImageStorage();
    const campaignMemberService = makeCampaignMemberService();
    vi.mocked(campaignMemberService.getMembership).mockResolvedValue(null);
    const context = makeContext(
      entityService,
      imageStorage,
      campaignMemberService,
      authenticatedUser,
    );
    const input = {
      campaignId: "campaign-1",
      type: "npc",
      name: "Goblin",
      visibility: EntityVisibility.PUBLIC,
    };

    await expect(
      Mutation.createEntity(undefined, { input }, context),
    ).rejects.toMatchObject({ extensions: { code: "FORBIDDEN" } });
    expect(entityService.createEntity).not.toHaveBeenCalled();
  });

  it("rejects with FORBIDDEN when the campaign member is a Player", async () => {
    const entityService = makeEntityService();
    const imageStorage = makeImageStorage();
    const campaignMemberService = makeCampaignMemberService();
    vi.mocked(campaignMemberService.getMembership).mockResolvedValue(
      playerMembership,
    );
    const context = makeContext(
      entityService,
      imageStorage,
      campaignMemberService,
      authenticatedUser,
    );
    const input = {
      campaignId: "campaign-1",
      type: "npc",
      name: "Goblin",
      visibility: EntityVisibility.PUBLIC,
    };

    await expect(
      Mutation.createEntity(undefined, { input }, context),
    ).rejects.toMatchObject({ extensions: { code: "FORBIDDEN" } });
    expect(entityService.createEntity).not.toHaveBeenCalled();
  });

  it("delegates to entityService when the user is a campaign member", async () => {
    const entityService = makeEntityService();
    const imageStorage = makeImageStorage();
    const campaignMemberService = makeCampaignMemberService();
    vi.mocked(campaignMemberService.getMembership).mockResolvedValue(
      membership,
    );
    const entity = Entity.create({
      campaignId: "campaign-1",
      type: "npc",
      name: "Goblin",
      visibility: EntityVisibility.PUBLIC,
    });
    vi.mocked(entityService.createEntity).mockResolvedValue(entity);
    const context = makeContext(
      entityService,
      imageStorage,
      campaignMemberService,
      authenticatedUser,
    );
    const input = {
      campaignId: "campaign-1",
      type: "npc",
      name: "Goblin",
      visibility: EntityVisibility.PUBLIC,
    };

    const result = await Mutation.createEntity(undefined, { input }, context);

    expect(entityService.createEntity).toHaveBeenCalledWith(input);
    expect(result).toBe(entity);
  });

  it("delegates to entityService when the campaign member is a Co-Storyteller", async () => {
    const entityService = makeEntityService();
    const imageStorage = makeImageStorage();
    const campaignMemberService = makeCampaignMemberService();
    vi.mocked(campaignMemberService.getMembership).mockResolvedValue(
      coStorytellerMembership,
    );
    const entity = Entity.create({
      campaignId: "campaign-1",
      type: "npc",
      name: "Goblin",
      visibility: EntityVisibility.PUBLIC,
    });
    vi.mocked(entityService.createEntity).mockResolvedValue(entity);
    const context = makeContext(
      entityService,
      imageStorage,
      campaignMemberService,
      authenticatedUser,
    );
    const input = {
      campaignId: "campaign-1",
      type: "npc",
      name: "Goblin",
      visibility: EntityVisibility.PUBLIC,
    };

    const result = await Mutation.createEntity(undefined, { input }, context);

    expect(entityService.createEntity).toHaveBeenCalledWith(input);
    expect(result).toBe(entity);
  });

  it("rejects with FORBIDDEN when the campaign member is an Observer", async () => {
    const entityService = makeEntityService();
    const imageStorage = makeImageStorage();
    const campaignMemberService = makeCampaignMemberService();
    vi.mocked(campaignMemberService.getMembership).mockResolvedValue(
      observerMembership,
    );
    const context = makeContext(
      entityService,
      imageStorage,
      campaignMemberService,
      authenticatedUser,
    );
    const input = {
      campaignId: "campaign-1",
      type: "npc",
      name: "Goblin",
      visibility: EntityVisibility.PUBLIC,
    };

    await expect(
      Mutation.createEntity(undefined, { input }, context),
    ).rejects.toMatchObject({ extensions: { code: "FORBIDDEN" } });
    expect(entityService.createEntity).not.toHaveBeenCalled();
  });
});

describe("entities Mutation.updateEntity", () => {
  it("rejects with UNAUTHENTICATED when logged out", async () => {
    const entityService = makeEntityService();
    const imageStorage = makeImageStorage();
    const campaignMemberService = makeCampaignMemberService();
    const context = makeContext(
      entityService,
      imageStorage,
      campaignMemberService,
      loggedOutUser,
    );
    const input = { id: "entity-1", name: "Renamed" };

    await expect(
      Mutation.updateEntity(undefined, { input }, context),
    ).rejects.toMatchObject({
      extensions: { code: "UNAUTHENTICATED" },
    });
    expect(entityService.updateEntity).not.toHaveBeenCalled();
  });

  it("rejects with FORBIDDEN when not a member of the entity's campaign", async () => {
    const entityService = makeEntityService();
    const imageStorage = makeImageStorage();
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
      imageStorage,
      campaignMemberService,
      authenticatedUser,
    );
    const input = { id: "entity-1", name: "Renamed" };

    await expect(
      Mutation.updateEntity(undefined, { input }, context),
    ).rejects.toMatchObject({ extensions: { code: "FORBIDDEN" } });
    expect(entityService.updateEntity).not.toHaveBeenCalled();
  });

  it("rejects with FORBIDDEN when the campaign member is a Player", async () => {
    const entityService = makeEntityService();
    const imageStorage = makeImageStorage();
    const campaignMemberService = makeCampaignMemberService();
    const entity = Entity.create({
      campaignId: "campaign-1",
      type: "npc",
      name: "Goblin",
      visibility: EntityVisibility.PUBLIC,
    });
    vi.mocked(entityService.getEntity).mockResolvedValue(entity);
    vi.mocked(campaignMemberService.getMembership).mockResolvedValue(
      playerMembership,
    );
    const context = makeContext(
      entityService,
      imageStorage,
      campaignMemberService,
      authenticatedUser,
    );
    const input = { id: "entity-1", name: "Renamed" };

    await expect(
      Mutation.updateEntity(undefined, { input }, context),
    ).rejects.toMatchObject({ extensions: { code: "FORBIDDEN" } });
    expect(entityService.updateEntity).not.toHaveBeenCalled();
  });

  it("delegates to entityService when the user is a campaign member", async () => {
    const entityService = makeEntityService();
    const imageStorage = makeImageStorage();
    const campaignMemberService = makeCampaignMemberService();
    const existing = Entity.create({
      campaignId: "campaign-1",
      type: "npc",
      name: "Goblin",
      visibility: EntityVisibility.PUBLIC,
    });
    vi.mocked(entityService.getEntity).mockResolvedValue(existing);
    vi.mocked(campaignMemberService.getMembership).mockResolvedValue(
      membership,
    );
    const updated = Entity.create({
      campaignId: "campaign-1",
      type: "npc",
      name: "Renamed",
      visibility: EntityVisibility.PUBLIC,
    });
    vi.mocked(entityService.updateEntity).mockResolvedValue(updated);
    const context = makeContext(
      entityService,
      imageStorage,
      campaignMemberService,
      authenticatedUser,
    );
    const input = { id: "entity-1", name: "Renamed" };

    const result = await Mutation.updateEntity(undefined, { input }, context);

    expect(entityService.updateEntity).toHaveBeenCalledWith(input);
    expect(result).toBe(updated);
  });
});

describe("entities Mutation.deleteEntity", () => {
  it("rejects with UNAUTHENTICATED when logged out", async () => {
    const entityService = makeEntityService();
    const imageStorage = makeImageStorage();
    const campaignMemberService = makeCampaignMemberService();
    const context = makeContext(
      entityService,
      imageStorage,
      campaignMemberService,
      loggedOutUser,
    );

    await expect(
      Mutation.deleteEntity(undefined, { id: "entity-1" }, context),
    ).rejects.toMatchObject({
      extensions: { code: "UNAUTHENTICATED" },
    });
    expect(entityService.deleteEntity).not.toHaveBeenCalled();
  });

  it("rejects with FORBIDDEN when not a member of the entity's campaign", async () => {
    const entityService = makeEntityService();
    const imageStorage = makeImageStorage();
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
      imageStorage,
      campaignMemberService,
      authenticatedUser,
    );

    await expect(
      Mutation.deleteEntity(undefined, { id: "entity-1" }, context),
    ).rejects.toMatchObject({ extensions: { code: "FORBIDDEN" } });
    expect(entityService.deleteEntity).not.toHaveBeenCalled();
  });

  it("rejects with FORBIDDEN when the campaign member is a Player", async () => {
    const entityService = makeEntityService();
    const imageStorage = makeImageStorage();
    const campaignMemberService = makeCampaignMemberService();
    const entity = Entity.create({
      campaignId: "campaign-1",
      type: "npc",
      name: "Goblin",
      visibility: EntityVisibility.PUBLIC,
    });
    vi.mocked(entityService.getEntity).mockResolvedValue(entity);
    vi.mocked(campaignMemberService.getMembership).mockResolvedValue(
      playerMembership,
    );
    const context = makeContext(
      entityService,
      imageStorage,
      campaignMemberService,
      authenticatedUser,
    );

    await expect(
      Mutation.deleteEntity(undefined, { id: "entity-1" }, context),
    ).rejects.toMatchObject({ extensions: { code: "FORBIDDEN" } });
    expect(entityService.deleteEntity).not.toHaveBeenCalled();
  });

  it("delegates to entityService and returns true when the user is a campaign member", async () => {
    const entityService = makeEntityService();
    const imageStorage = makeImageStorage();
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
    vi.mocked(entityService.deleteEntity).mockResolvedValue(undefined);
    const context = makeContext(
      entityService,
      imageStorage,
      campaignMemberService,
      authenticatedUser,
    );

    const result = await Mutation.deleteEntity(
      undefined,
      { id: "entity-1" },
      context,
    );

    expect(entityService.deleteEntity).toHaveBeenCalledWith("entity-1");
    expect(result).toBe(true);
  });
});

describe("entities Mutation.uploadEntityImage", () => {
  it("rejects with UNAUTHENTICATED when logged out", async () => {
    const entityService = makeEntityService();
    const imageStorage = makeImageStorage();
    const campaignMemberService = makeCampaignMemberService();
    const context = makeContext(
      entityService,
      imageStorage,
      campaignMemberService,
      loggedOutUser,
    );

    await expect(
      Mutation.uploadEntityImage(
        undefined,
        { entityId: "entity-1", file },
        context,
      ),
    ).rejects.toMatchObject({
      extensions: { code: "UNAUTHENTICATED" },
    });
    expect(imageStorage.save).not.toHaveBeenCalled();
    expect(entityService.setEntityImage).not.toHaveBeenCalled();
  });

  it("rejects with FORBIDDEN when not a member of the entity's campaign", async () => {
    const entityService = makeEntityService();
    const imageStorage = makeImageStorage();
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
      imageStorage,
      campaignMemberService,
      authenticatedUser,
    );

    await expect(
      Mutation.uploadEntityImage(
        undefined,
        { entityId: "entity-1", file },
        context,
      ),
    ).rejects.toMatchObject({ extensions: { code: "FORBIDDEN" } });
    expect(imageStorage.save).not.toHaveBeenCalled();
    expect(entityService.setEntityImage).not.toHaveBeenCalled();
  });

  it("rejects with FORBIDDEN when the campaign member is a Player", async () => {
    const entityService = makeEntityService();
    const imageStorage = makeImageStorage();
    const campaignMemberService = makeCampaignMemberService();
    const entity = Entity.create({
      campaignId: "campaign-1",
      type: "npc",
      name: "Goblin",
      visibility: EntityVisibility.PUBLIC,
    });
    vi.mocked(entityService.getEntity).mockResolvedValue(entity);
    vi.mocked(campaignMemberService.getMembership).mockResolvedValue(
      playerMembership,
    );
    const context = makeContext(
      entityService,
      imageStorage,
      campaignMemberService,
      authenticatedUser,
    );

    await expect(
      Mutation.uploadEntityImage(
        undefined,
        { entityId: "entity-1", file },
        context,
      ),
    ).rejects.toMatchObject({ extensions: { code: "FORBIDDEN" } });
    expect(imageStorage.save).not.toHaveBeenCalled();
    expect(entityService.setEntityImage).not.toHaveBeenCalled();
  });

  it("saves the file and updates the entity when the user is a campaign member", async () => {
    const entityService = makeEntityService();
    const imageStorage = makeImageStorage();
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
    vi.mocked(imageStorage.save).mockResolvedValue("/uploads/entity-1/a.png");
    const updated = Entity.create({
      campaignId: "campaign-1",
      type: "npc",
      name: "Goblin",
      image: "/uploads/entity-1/a.png",
      visibility: EntityVisibility.PUBLIC,
    });
    vi.mocked(entityService.setEntityImage).mockResolvedValue(updated);
    const context = makeContext(
      entityService,
      imageStorage,
      campaignMemberService,
      authenticatedUser,
    );

    const result = await Mutation.uploadEntityImage(
      undefined,
      { entityId: "entity-1", file },
      context,
    );

    expect(imageStorage.save).toHaveBeenCalledWith("entity-1", file);
    expect(entityService.setEntityImage).toHaveBeenCalledWith(
      "entity-1",
      "/uploads/entity-1/a.png",
    );
    expect(result).toBe(updated);
  });
});

describe("resolveForceOpenTargetUserIds", () => {
  const storytellerUser = User.create({
    email: "storyteller@example.com",
    password: "hashed",
  });
  const playerOneUser = User.create({
    email: "player-one@example.com",
    password: "hashed",
  });
  const playerTwoUser = User.create({
    email: "player-two@example.com",
    password: "hashed",
  });
  const observerUser = User.create({
    email: "observer@example.com",
    password: "hashed",
  });

  const roster = [
    CampaignMember.create({
      campaignId: "campaign-1",
      userId: storytellerUser.Id,
      role: "STORYTELLER",
    }),
    CampaignMember.create({
      campaignId: "campaign-1",
      userId: playerOneUser.Id,
      role: "PLAYER",
    }),
    CampaignMember.create({
      campaignId: "campaign-1",
      userId: playerTwoUser.Id,
      role: "PLAYER",
    }),
    CampaignMember.create({
      campaignId: "campaign-1",
      userId: observerUser.Id,
      role: "OBSERVER",
    }),
  ];

  it("resolves allPlayers to every PLAYER/OBSERVER member, excluding the Storyteller", () => {
    const result = resolveForceOpenTargetUserIds(roster, {
      allPlayers: true,
      userIds: [],
    });

    expect(new Set(result)).toEqual(
      new Set([
        playerOneUser.Id.toString(),
        playerTwoUser.Id.toString(),
        observerUser.Id.toString(),
      ]),
    );
    expect(result).not.toContain(storytellerUser.Id.toString());
  });

  it("resolves an explicit userIds list to just that one targeted player", () => {
    const result = resolveForceOpenTargetUserIds(roster, {
      allPlayers: false,
      userIds: [playerOneUser.Id.toString()],
    });

    expect(result).toEqual([playerOneUser.Id.toString()]);
  });

  it("drops ids from the explicit list that aren't real campaign members", () => {
    const result = resolveForceOpenTargetUserIds(roster, {
      allPlayers: false,
      userIds: [playerOneUser.Id.toString(), "not-a-real-member"],
    });

    expect(result).toEqual([playerOneUser.Id.toString()]);
  });
});

describe("entities Mutation.forceOpenEntityWindow", () => {
  const playerUser = User.create({
    email: "player@example.com",
    password: "hashed",
  });

  const storytellerMembership = CampaignMember.create({
    campaignId: "campaign-1",
    userId: authenticatedUser.Id,
    role: "STORYTELLER",
  });

  const roster = [
    storytellerMembership,
    CampaignMember.create({
      campaignId: "campaign-1",
      userId: playerUser.Id,
      role: "PLAYER",
    }),
  ];

  it("rejects with UNAUTHENTICATED when logged out", async () => {
    const entityService = makeEntityService();
    const imageStorage = makeImageStorage();
    const campaignMemberService = makeCampaignMemberService();
    const context = makeContext(
      entityService,
      imageStorage,
      campaignMemberService,
      loggedOutUser,
    );
    const input = {
      campaignId: "campaign-1",
      entityId: "entity-1",
      target: { allPlayers: true, userIds: [] },
    };

    await expect(
      Mutation.forceOpenEntityWindow(undefined, { input }, context),
    ).rejects.toMatchObject({ extensions: { code: "UNAUTHENTICATED" } });
    expect(entityService.getEntity).not.toHaveBeenCalled();
    expect(context.pubSub.publish).not.toHaveBeenCalled();
  });

  it("rejects with FORBIDDEN when the campaign member is a Player (lacks BROADCAST_TO_PLAYERS)", async () => {
    const entityService = makeEntityService();
    const imageStorage = makeImageStorage();
    const campaignMemberService = makeCampaignMemberService();
    vi.mocked(campaignMemberService.getMembership).mockResolvedValue(
      playerMembership,
    );
    const context = makeContext(
      entityService,
      imageStorage,
      campaignMemberService,
      authenticatedUser,
    );
    const input = {
      campaignId: "campaign-1",
      entityId: "entity-1",
      target: { allPlayers: true, userIds: [] },
    };

    await expect(
      Mutation.forceOpenEntityWindow(undefined, { input }, context),
    ).rejects.toMatchObject({ extensions: { code: "FORBIDDEN" } });
    expect(entityService.getEntity).not.toHaveBeenCalled();
    expect(context.pubSub.publish).not.toHaveBeenCalled();
  });

  it("publishes a PRIVATE-visibility entity to a targeted Player — the intentional visibility bypass", async () => {
    const entityService = makeEntityService();
    const imageStorage = makeImageStorage();
    const campaignMemberService = makeCampaignMemberService();
    vi.mocked(campaignMemberService.getMembership).mockResolvedValue(
      storytellerMembership,
    );
    vi.mocked(campaignMemberService.listMembers).mockResolvedValue(roster);
    const secretEntity = Entity.create({
      campaignId: "campaign-1",
      type: "npc",
      name: "Secret Villain",
      visibility: EntityVisibility.PRIVATE,
    });
    vi.mocked(entityService.getEntity).mockResolvedValue(secretEntity);
    const context = makeContext(
      entityService,
      imageStorage,
      campaignMemberService,
      authenticatedUser,
    );
    const input = {
      campaignId: "campaign-1",
      entityId: "entity-1",
      target: { allPlayers: false, userIds: [playerUser.Id.toString()] },
    };

    const result = await Mutation.forceOpenEntityWindow(
      undefined,
      { input },
      context,
    );

    expect(result).toBe(true);
    // The published payload carries the resolved entity directly — with its
    // PRIVATE visibility unchanged/unfiltered — proving the visibility
    // filter that gates the normal `entity`/`entities` queries is
    // deliberately not applied here.
    expect(context.pubSub.publish).toHaveBeenCalledWith(
      "entityWindowForceOpened",
      "campaign-1",
      {
        entity: secretEntity,
        targetUserIds: [playerUser.Id.toString()],
      },
    );
    expect(secretEntity.Visibility).toBe(EntityVisibility.PRIVATE);
  });

  it("resolves allPlayers to the full PLAYER/OBSERVER roster", async () => {
    const entityService = makeEntityService();
    const imageStorage = makeImageStorage();
    const campaignMemberService = makeCampaignMemberService();
    vi.mocked(campaignMemberService.getMembership).mockResolvedValue(
      storytellerMembership,
    );
    vi.mocked(campaignMemberService.listMembers).mockResolvedValue(roster);
    const entity = Entity.create({
      campaignId: "campaign-1",
      type: "npc",
      name: "Goblin",
      visibility: EntityVisibility.PUBLIC,
    });
    vi.mocked(entityService.getEntity).mockResolvedValue(entity);
    const context = makeContext(
      entityService,
      imageStorage,
      campaignMemberService,
      authenticatedUser,
    );
    const input = {
      campaignId: "campaign-1",
      entityId: "entity-1",
      target: { allPlayers: true, userIds: [] },
    };

    await Mutation.forceOpenEntityWindow(undefined, { input }, context);

    expect(context.pubSub.publish).toHaveBeenCalledWith(
      "entityWindowForceOpened",
      "campaign-1",
      {
        entity,
        targetUserIds: [playerUser.Id.toString()],
      },
    );
  });

  it("rejects with FORBIDDEN when the entity does not belong to the given campaign", async () => {
    const entityService = makeEntityService();
    const imageStorage = makeImageStorage();
    const campaignMemberService = makeCampaignMemberService();
    vi.mocked(campaignMemberService.getMembership).mockResolvedValue(
      storytellerMembership,
    );
    const otherCampaignEntity = Entity.create({
      campaignId: "campaign-2",
      type: "npc",
      name: "Goblin",
      visibility: EntityVisibility.PUBLIC,
    });
    vi.mocked(entityService.getEntity).mockResolvedValue(otherCampaignEntity);
    const context = makeContext(
      entityService,
      imageStorage,
      campaignMemberService,
      authenticatedUser,
    );
    const input = {
      campaignId: "campaign-1",
      entityId: "entity-1",
      target: { allPlayers: true, userIds: [] },
    };

    await expect(
      Mutation.forceOpenEntityWindow(undefined, { input }, context),
    ).rejects.toMatchObject({ extensions: { code: "FORBIDDEN" } });
    expect(context.pubSub.publish).not.toHaveBeenCalled();
  });
});
