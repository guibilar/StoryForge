import { beforeEach, describe, expect, it, vi } from "vitest";
import { CampaignMember, Relationship, User } from "@storyforge/domain";
import { Mutation } from "./Mutation";
import type { GraphQLContext } from "../../../../graphql/context";
import type { RelationshipService } from "../../application/RelationshipService";
import type { CampaignMemberService } from "../../../campaignMembers/application/CampaignMemberService";

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

function makeContext(
  relationshipService: RelationshipService,
  campaignMemberService: CampaignMemberService,
  currentUser: User | null,
): GraphQLContext {
  return {
    relationshipService,
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

const relationship = Relationship.create({
  campaignId: "campaign-1",
  sourceEntityId: "entity-1",
  targetEntityId: "entity-2",
  type: "ALLY",
});

describe("relationships Mutation", () => {
  let relationshipService: RelationshipService;
  let campaignMemberService: CampaignMemberService;

  beforeEach(() => {
    relationshipService = makeRelationshipService();
    campaignMemberService = makeCampaignMemberService();
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
      const context = makeContext(
        relationshipService,
        campaignMemberService,
        loggedOutUser,
      );

      await expect(
        Mutation.createRelationship(undefined, args, context),
      ).rejects.toMatchObject({
        extensions: { code: "UNAUTHENTICATED" },
      });
      expect(relationshipService.createRelationship).not.toHaveBeenCalled();
    });

    it("rejects with FORBIDDEN when not a campaign member", async () => {
      vi.mocked(campaignMemberService.getMembership).mockResolvedValue(null);
      const context = makeContext(
        relationshipService,
        campaignMemberService,
        authenticatedUser,
      );

      await expect(
        Mutation.createRelationship(undefined, args, context),
      ).rejects.toMatchObject({ extensions: { code: "FORBIDDEN" } });
      expect(relationshipService.createRelationship).not.toHaveBeenCalled();
    });

    it("rejects with FORBIDDEN when the member's role cannot write", async () => {
      vi.mocked(campaignMemberService.getMembership).mockResolvedValue(
        playerMembership,
      );
      const context = makeContext(
        relationshipService,
        campaignMemberService,
        authenticatedUser,
      );

      await expect(
        Mutation.createRelationship(undefined, args, context),
      ).rejects.toMatchObject({ extensions: { code: "FORBIDDEN" } });
      expect(relationshipService.createRelationship).not.toHaveBeenCalled();
    });

    it("delegates to relationshipService when the user is a campaign member", async () => {
      vi.mocked(campaignMemberService.getMembership).mockResolvedValue(
        membership,
      );
      vi.mocked(relationshipService.createRelationship).mockResolvedValue(
        relationship,
      );
      const context = makeContext(
        relationshipService,
        campaignMemberService,
        authenticatedUser,
      );

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
      const context = makeContext(
        relationshipService,
        campaignMemberService,
        loggedOutUser,
      );

      await expect(
        Mutation.updateRelationship(undefined, args, context),
      ).rejects.toMatchObject({
        extensions: { code: "UNAUTHENTICATED" },
      });
      expect(relationshipService.updateRelationship).not.toHaveBeenCalled();
    });

    it("rejects with FORBIDDEN when not a member of the relationship's campaign", async () => {
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
        Mutation.updateRelationship(undefined, args, context),
      ).rejects.toMatchObject({ extensions: { code: "FORBIDDEN" } });
      expect(relationshipService.updateRelationship).not.toHaveBeenCalled();
    });

    it("delegates to relationshipService when the user is a campaign member", async () => {
      vi.mocked(relationshipService.getRelationship).mockResolvedValue(
        relationship,
      );
      vi.mocked(campaignMemberService.getMembership).mockResolvedValue(
        membership,
      );
      const updated = Relationship.create({
        campaignId: "campaign-1",
        sourceEntityId: "entity-1",
        targetEntityId: "entity-2",
        type: "ENEMY",
      });
      vi.mocked(relationshipService.updateRelationship).mockResolvedValue(
        updated,
      );
      const context = makeContext(
        relationshipService,
        campaignMemberService,
        authenticatedUser,
      );

      const result = await Mutation.updateRelationship(
        undefined,
        args,
        context,
      );

      expect(relationshipService.updateRelationship).toHaveBeenCalledWith(
        args.input,
      );
      expect(result).toBe(updated);
    });
  });

  describe("deleteRelationship", () => {
    const args = { id: "relationship-1" };

    it("rejects with UNAUTHENTICATED when logged out", async () => {
      const context = makeContext(
        relationshipService,
        campaignMemberService,
        loggedOutUser,
      );

      await expect(
        Mutation.deleteRelationship(undefined, args, context),
      ).rejects.toMatchObject({
        extensions: { code: "UNAUTHENTICATED" },
      });
      expect(relationshipService.deleteRelationship).not.toHaveBeenCalled();
    });

    it("rejects with FORBIDDEN when not a member of the relationship's campaign", async () => {
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
        Mutation.deleteRelationship(undefined, args, context),
      ).rejects.toMatchObject({ extensions: { code: "FORBIDDEN" } });
      expect(relationshipService.deleteRelationship).not.toHaveBeenCalled();
    });

    it("delegates to relationshipService and returns true when the user is a campaign member", async () => {
      vi.mocked(relationshipService.getRelationship).mockResolvedValue(
        relationship,
      );
      vi.mocked(campaignMemberService.getMembership).mockResolvedValue(
        membership,
      );
      vi.mocked(relationshipService.deleteRelationship).mockResolvedValue(
        undefined,
      );
      const context = makeContext(
        relationshipService,
        campaignMemberService,
        authenticatedUser,
      );

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
