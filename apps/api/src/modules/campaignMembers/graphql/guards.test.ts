import { describe, expect, it, vi } from "vitest";
import {
  AuthenticationError,
  CampaignMember,
  CampaignRole,
  ForbiddenError,
  User,
} from "@storyforge/domain";
import {
  requireCampaignBroadcaster,
  requireCampaignMember,
  requireCampaignRole,
  requireCampaignWriter,
} from "./guards";
import type { GraphQLContext } from "../../../graphql/context";
import type { CampaignMemberService } from "../application/CampaignMemberService";

function makeContext(
  currentUser: User | null,
  campaignMemberService: Partial<CampaignMemberService>,
): GraphQLContext {
  return { currentUser, campaignMemberService } as GraphQLContext;
}

function makeMembership(role: CampaignRole): CampaignMember {
  return CampaignMember.create({
    campaignId,
    userId: user.Id,
    role,
  });
}

const campaignId = "campaign-1";
const user = User.create({ email: "owner@example.com", password: "hashed" });

describe("requireCampaignMember", () => {
  it("throws AuthenticationError when logged out", async () => {
    const context = makeContext(null, { getMembership: vi.fn() });

    await expect(requireCampaignMember(context, campaignId)).rejects.toThrow(
      AuthenticationError,
    );
  });

  it("throws ForbiddenError when the user has no membership", async () => {
    const context = makeContext(user, {
      getMembership: vi.fn().mockResolvedValue(null),
    });

    await expect(requireCampaignMember(context, campaignId)).rejects.toThrow(
      ForbiddenError,
    );
  });

  it("resolves with the membership for any role", async () => {
    const membership = makeMembership("PLAYER");
    const getMembership = vi.fn().mockResolvedValue(membership);
    const context = makeContext(user, { getMembership });

    await expect(requireCampaignMember(context, campaignId)).resolves.toBe(
      membership,
    );
    expect(getMembership).toHaveBeenCalledWith(campaignId, user.Id.toString());
  });
});

describe("requireCampaignRole", () => {
  it("throws AuthenticationError when logged out", async () => {
    const context = makeContext(null, { getMembership: vi.fn() });

    await expect(
      requireCampaignRole(context, campaignId, "MANAGE_MEMBERS"),
    ).rejects.toThrow(AuthenticationError);
  });

  it("throws ForbiddenError when the user has no membership", async () => {
    const context = makeContext(user, {
      getMembership: vi.fn().mockResolvedValue(null),
    });

    await expect(
      requireCampaignRole(context, campaignId, "MANAGE_MEMBERS"),
    ).rejects.toThrow(ForbiddenError);
  });

  it.each(["STORYTELLER", "CO_STORYTELLER", "PLAYER", "OBSERVER"] as const)(
    "throws ForbiddenError when a %s attempts an Owner-only action",
    async (role) => {
      const membership = makeMembership(role);
      const context = makeContext(user, {
        getMembership: vi.fn().mockResolvedValue(membership),
      });

      await expect(
        requireCampaignRole(context, campaignId, "MANAGE_CAMPAIGN_SETTINGS"),
      ).rejects.toThrow(ForbiddenError);
    },
  );

  it("resolves with the membership when the Owner performs an Owner-only action", async () => {
    const membership = makeMembership("OWNER");
    const getMembership = vi.fn().mockResolvedValue(membership);
    const context = makeContext(user, { getMembership });

    await expect(
      requireCampaignRole(context, campaignId, "MANAGE_CAMPAIGN_SETTINGS"),
    ).resolves.toBe(membership);
    expect(getMembership).toHaveBeenCalledWith(campaignId, user.Id.toString());
  });

  it.each([
    "OWNER",
    "STORYTELLER",
    "CO_STORYTELLER",
    "PLAYER",
    "OBSERVER",
  ] as const)(
    "resolves for %s on an action every role can perform",
    async (role) => {
      const membership = makeMembership(role);
      const context = makeContext(user, {
        getMembership: vi.fn().mockResolvedValue(membership),
      });

      await expect(
        requireCampaignRole(context, campaignId, "VIEW_ENTITY"),
      ).resolves.toBe(membership);
    },
  );
});

describe("requireCampaignWriter", () => {
  it("throws AuthenticationError when logged out", async () => {
    const context = makeContext(null, { getMembership: vi.fn() });

    await expect(requireCampaignWriter(context, campaignId)).rejects.toThrow(
      AuthenticationError,
    );
  });

  it("throws ForbiddenError when the user has no membership", async () => {
    const context = makeContext(user, {
      getMembership: vi.fn().mockResolvedValue(null),
    });

    await expect(requireCampaignWriter(context, campaignId)).rejects.toThrow(
      ForbiddenError,
    );
  });

  it.each(["PLAYER", "OBSERVER"] as const)(
    "throws ForbiddenError when the user is a %s",
    async (role) => {
      const membership = makeMembership(role);
      const context = makeContext(user, {
        getMembership: vi.fn().mockResolvedValue(membership),
      });

      await expect(requireCampaignWriter(context, campaignId)).rejects.toThrow(
        ForbiddenError,
      );
    },
  );

  it.each(["OWNER", "STORYTELLER", "CO_STORYTELLER"] as const)(
    "resolves with the membership when the user is a %s",
    async (role) => {
      const membership = makeMembership(role);
      const getMembership = vi.fn().mockResolvedValue(membership);
      const context = makeContext(user, { getMembership });

      await expect(requireCampaignWriter(context, campaignId)).resolves.toBe(
        membership,
      );
    },
  );
});

describe("requireCampaignBroadcaster", () => {
  it("throws AuthenticationError when logged out", async () => {
    const context = makeContext(null, { getMembership: vi.fn() });

    await expect(
      requireCampaignBroadcaster(context, campaignId),
    ).rejects.toThrow(AuthenticationError);
  });

  it("throws ForbiddenError when the user has no membership", async () => {
    const context = makeContext(user, {
      getMembership: vi.fn().mockResolvedValue(null),
    });

    await expect(
      requireCampaignBroadcaster(context, campaignId),
    ).rejects.toThrow(ForbiddenError);
  });

  it.each(["PLAYER", "OBSERVER"] as const)(
    "throws ForbiddenError when the user is a %s",
    async (role) => {
      const membership = makeMembership(role);
      const context = makeContext(user, {
        getMembership: vi.fn().mockResolvedValue(membership),
      });

      await expect(
        requireCampaignBroadcaster(context, campaignId),
      ).rejects.toThrow(ForbiddenError);
    },
  );

  it.each(["OWNER", "STORYTELLER", "CO_STORYTELLER"] as const)(
    "resolves with the membership when the user is a %s",
    async (role) => {
      const membership = makeMembership(role);
      const getMembership = vi.fn().mockResolvedValue(membership);
      const context = makeContext(user, { getMembership });

      await expect(
        requireCampaignBroadcaster(context, campaignId),
      ).resolves.toBe(membership);
    },
  );
});
