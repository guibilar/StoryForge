import { describe, expect, it, vi } from "vitest";
import { NotFoundError, Relationship, User } from "@storyforge/domain";
import { Query } from "./Query";
import type { GraphQLContext } from "../../../../graphql/context";
import type { RelationshipService } from "../../application/RelationshipService";

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

function makeContext(
  relationshipService: RelationshipService,
  currentUser: User | null,
): GraphQLContext {
  return { relationshipService, currentUser } as GraphQLContext;
}

const loggedOutUser = null;
const authenticatedUser = User.create({
  email: "user@example.com",
  password: "hashed",
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
    const context = makeContext(relationshipService, loggedOutUser);

    await expect(
      Query.relationship(undefined, { id: "relationship-1" }, context),
    ).rejects.toMatchObject({
      extensions: { code: "UNAUTHENTICATED" },
    });
    expect(relationshipService.getRelationship).not.toHaveBeenCalled();
  });

  it("returns the relationship from the service", async () => {
    const relationshipService = makeRelationshipService();
    vi.mocked(relationshipService.getRelationship).mockResolvedValue(
      relationship,
    );
    const context = makeContext(relationshipService, authenticatedUser);

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
    vi.mocked(relationshipService.getRelationship).mockRejectedValue(
      new NotFoundError("Relationship not found"),
    );
    const context = makeContext(relationshipService, authenticatedUser);

    await expect(
      Query.relationship(undefined, { id: "missing" }, context),
    ).rejects.toMatchObject({ extensions: { code: "NOT_FOUND" } });
  });
});

describe("relationships Query.relationships", () => {
  it("rejects with UNAUTHENTICATED when logged out", async () => {
    const relationshipService = makeRelationshipService();
    const context = makeContext(relationshipService, loggedOutUser);

    await expect(
      Query.relationships(undefined, { campaignId: "campaign-1" }, context),
    ).rejects.toMatchObject({
      extensions: { code: "UNAUTHENTICATED" },
    });
    expect(
      relationshipService.listRelationshipsByCampaign,
    ).not.toHaveBeenCalled();
  });

  it("delegates to listRelationshipsByCampaign when no entityId is given", async () => {
    const relationshipService = makeRelationshipService();
    vi.mocked(
      relationshipService.listRelationshipsByCampaign,
    ).mockResolvedValue([relationship]);
    const context = makeContext(relationshipService, authenticatedUser);

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
    vi.mocked(relationshipService.listRelationshipsByEntity).mockResolvedValue([
      relationship,
    ]);
    const context = makeContext(relationshipService, authenticatedUser);

    const result = await Query.relationships(
      undefined,
      { campaignId: "campaign-1", entityId: "entity-1" },
      context,
    );

    expect(relationshipService.listRelationshipsByEntity).toHaveBeenCalledWith(
      "entity-1",
    );
    expect(
      relationshipService.listRelationshipsByCampaign,
    ).not.toHaveBeenCalled();
    expect(result).toEqual([relationship]);
  });

  it("translates domain errors into GraphQL errors", async () => {
    const relationshipService = makeRelationshipService();
    vi.mocked(
      relationshipService.listRelationshipsByCampaign,
    ).mockRejectedValue(new NotFoundError("Campaign not found"));
    const context = makeContext(relationshipService, authenticatedUser);

    await expect(
      Query.relationships(undefined, { campaignId: "missing" }, context),
    ).rejects.toMatchObject({ extensions: { code: "NOT_FOUND" } });
  });
});
