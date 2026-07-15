import { describe, expect, it, vi } from "vitest";
import {
  CampaignMember,
  Entity,
  EntityVisibility,
  User,
} from "@storyforge/domain";
import { Mutation } from "./Mutation";
import type { GraphQLContext } from "../../../../graphql/context";
import type { EntityService } from "../../application/EntityService";
import type { LocalImageStore } from "../../infrastructure/LocalImageStore";
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

function makeImageStorage(): LocalImageStore {
  return { save: vi.fn() } as unknown as LocalImageStore;
}

function makeCampaignMemberService(): CampaignMemberService {
  return { getMembership: vi.fn() } as unknown as CampaignMemberService;
}

function makeContext(
  entityService: EntityService,
  imageStorage: LocalImageStore,
  campaignMemberService: CampaignMemberService,
  currentUser: User | null,
): GraphQLContext {
  return {
    entityService,
    imageStorage,
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
