import { beforeEach, describe, expect, it, vi } from "vitest";
import { Relationship, User } from "@storyforge/domain";
import { Mutation } from "./Mutation";
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

describe("relationships Mutation", () => {
  let relationshipService: RelationshipService;

  beforeEach(() => {
    relationshipService = makeRelationshipService();
  });

  describe("createRelationship", () => {
    const args = {
      input: {
        campaignId: "campaign-1",
        sourceEntityId: "entity-1",
        targetEntityId: "entity-2",
        type: "ALLY",
      },
    };

    it("rejects with UNAUTHENTICATED when logged out", async () => {
      const context = makeContext(relationshipService, loggedOutUser);

      await expect(
        Mutation.createRelationship(undefined, args, context),
      ).rejects.toMatchObject({
        extensions: { code: "UNAUTHENTICATED" },
      });
      expect(relationshipService.createRelationship).not.toHaveBeenCalled();
    });

    it("delegates to relationshipService when authenticated", async () => {
      const relationship = { id: "relationship-1" } as unknown as Relationship;
      vi.mocked(relationshipService.createRelationship).mockResolvedValue(
        relationship,
      );
      const context = makeContext(relationshipService, authenticatedUser);

      const result = await Mutation.createRelationship(
        undefined,
        args,
        context,
      );

      expect(relationshipService.createRelationship).toHaveBeenCalledWith(
        args.input,
      );
      expect(result).toBe(relationship);
    });
  });

  describe("updateRelationship", () => {
    const args = { input: { id: "relationship-1", type: "ENEMY" } };

    it("rejects with UNAUTHENTICATED when logged out", async () => {
      const context = makeContext(relationshipService, loggedOutUser);

      await expect(
        Mutation.updateRelationship(undefined, args, context),
      ).rejects.toMatchObject({
        extensions: { code: "UNAUTHENTICATED" },
      });
      expect(relationshipService.updateRelationship).not.toHaveBeenCalled();
    });

    it("delegates to relationshipService when authenticated", async () => {
      const relationship = { id: "relationship-1" } as unknown as Relationship;
      vi.mocked(relationshipService.updateRelationship).mockResolvedValue(
        relationship,
      );
      const context = makeContext(relationshipService, authenticatedUser);

      const result = await Mutation.updateRelationship(
        undefined,
        args,
        context,
      );

      expect(relationshipService.updateRelationship).toHaveBeenCalledWith(
        args.input,
      );
      expect(result).toBe(relationship);
    });
  });

  describe("deleteRelationship", () => {
    const args = { id: "relationship-1" };

    it("rejects with UNAUTHENTICATED when logged out", async () => {
      const context = makeContext(relationshipService, loggedOutUser);

      await expect(
        Mutation.deleteRelationship(undefined, args, context),
      ).rejects.toMatchObject({
        extensions: { code: "UNAUTHENTICATED" },
      });
      expect(relationshipService.deleteRelationship).not.toHaveBeenCalled();
    });

    it("delegates to relationshipService and returns true when authenticated", async () => {
      vi.mocked(relationshipService.deleteRelationship).mockResolvedValue(
        undefined,
      );
      const context = makeContext(relationshipService, authenticatedUser);

      const result = await Mutation.deleteRelationship(
        undefined,
        args,
        context,
      );

      expect(relationshipService.deleteRelationship).toHaveBeenCalledWith(
        "relationship-1",
      );
      expect(result).toBe(true);
    });
  });
});
