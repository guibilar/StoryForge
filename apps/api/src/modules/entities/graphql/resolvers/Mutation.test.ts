import { describe, expect, it, vi } from "vitest";
import { Entity, EntityVisibility, User } from "@storyforge/domain";
import { Mutation } from "./Mutation";
import type { GraphQLContext } from "../../../../graphql/context";
import type { EntityService } from "../../application/EntityService";
import type { LocalImageStore } from "../../infrastructure/LocalImageStore";

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

function makeContext(
  entityService: EntityService,
  imageStorage: LocalImageStore,
  currentUser: User | null,
): GraphQLContext {
  return { entityService, imageStorage, currentUser } as GraphQLContext;
}

const loggedOutUser = null;
const authenticatedUser = User.create({
  email: "user@example.com",
  password: "hashed",
});

const file = {
  name: "portrait.png",
  type: "image/png",
  arrayBuffer: async () => new ArrayBuffer(8),
} as File;

describe("entities Mutation.uploadEntityImage", () => {
  it("rejects with UNAUTHENTICATED when logged out", async () => {
    const entityService = makeEntityService();
    const imageStorage = makeImageStorage();
    const context = makeContext(entityService, imageStorage, loggedOutUser);

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

  it("saves the file and updates the entity when authenticated", async () => {
    const entityService = makeEntityService();
    const imageStorage = makeImageStorage();
    const entity = Entity.create({
      campaignId: "campaign-1",
      type: "npc",
      name: "Goblin",
      visibility: EntityVisibility.PUBLIC,
    });
    vi.mocked(imageStorage.save).mockResolvedValue("/uploads/entity-1/a.png");
    vi.mocked(entityService.setEntityImage).mockResolvedValue(entity);
    const context = makeContext(entityService, imageStorage, authenticatedUser);

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
    expect(result).toBe(entity);
  });
});
