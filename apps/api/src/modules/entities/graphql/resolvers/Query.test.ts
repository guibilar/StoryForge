import { describe, expect, it, vi } from "vitest";
import {
  Entity,
  EntityVisibility,
  NotFoundError,
  User,
} from "@storyforge/domain";
import { Query } from "./Query";
import type { GraphQLContext } from "../../../../graphql/context";
import type { EntityService } from "../../application/EntityService";

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

function makeContext(
  entityService: EntityService,
  currentUser: User | null,
): GraphQLContext {
  return { entityService, currentUser } as GraphQLContext;
}

const loggedOutUser = null;
const authenticatedUser = User.create({
  email: "user@example.com",
  password: "hashed",
});

describe("entities Query.entity", () => {
  it("rejects with UNAUTHENTICATED when logged out", async () => {
    const entityService = makeEntityService();
    const context = makeContext(entityService, loggedOutUser);

    await expect(
      Query.entity(undefined, { id: "entity-1" }, context),
    ).rejects.toMatchObject({
      extensions: { code: "UNAUTHENTICATED" },
    });
    expect(entityService.getEntity).not.toHaveBeenCalled();
  });

  it("returns the entity from the service", async () => {
    const entityService = makeEntityService();
    const entity = Entity.create({
      campaignId: "campaign-1",
      type: "npc",
      name: "Goblin",
      visibility: EntityVisibility.PUBLIC,
    });
    vi.mocked(entityService.getEntity).mockResolvedValue(entity);
    const context = makeContext(entityService, authenticatedUser);

    const result = await Query.entity(undefined, { id: "entity-1" }, context);

    expect(entityService.getEntity).toHaveBeenCalledWith("entity-1");
    expect(result).toBe(entity);
  });

  it("translates domain errors into GraphQL errors", async () => {
    const entityService = makeEntityService();
    vi.mocked(entityService.getEntity).mockRejectedValue(
      new NotFoundError("Entity not found"),
    );
    const context = makeContext(entityService, authenticatedUser);

    await expect(
      Query.entity(undefined, { id: "missing" }, context),
    ).rejects.toMatchObject({ extensions: { code: "NOT_FOUND" } });
  });
});

describe("entities Query.entities", () => {
  it("rejects with UNAUTHENTICATED when logged out", async () => {
    const entityService = makeEntityService();
    const context = makeContext(entityService, loggedOutUser);

    await expect(
      Query.entities(undefined, { campaignId: "campaign-1" }, context),
    ).rejects.toMatchObject({
      extensions: { code: "UNAUTHENTICATED" },
    });
    expect(entityService.listEntities).not.toHaveBeenCalled();
  });

  it("delegates to the service without a filter", async () => {
    const entityService = makeEntityService();
    const entities = [
      Entity.create({
        campaignId: "campaign-1",
        type: "npc",
        name: "Goblin",
        visibility: EntityVisibility.PUBLIC,
      }),
    ];
    vi.mocked(entityService.listEntities).mockResolvedValue(entities);
    const context = makeContext(entityService, authenticatedUser);

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
    vi.mocked(entityService.listEntities).mockResolvedValue([]);
    const context = makeContext(entityService, authenticatedUser);
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

  it("translates domain errors into GraphQL errors", async () => {
    const entityService = makeEntityService();
    vi.mocked(entityService.listEntities).mockRejectedValue(
      new NotFoundError("Campaign not found"),
    );
    const context = makeContext(entityService, authenticatedUser);

    await expect(
      Query.entities(undefined, { campaignId: "missing" }, context),
    ).rejects.toMatchObject({ extensions: { code: "NOT_FOUND" } });
  });
});
