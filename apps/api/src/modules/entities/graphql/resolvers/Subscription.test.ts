import { describe, expect, it, vi } from "vitest";
import { createPubSub } from "graphql-yoga";
import {
  CampaignMember,
  Entity,
  EntityVisibility,
  User,
} from "@storyforge/domain";
import { Subscription } from "./Subscription";
import type { GraphQLContext } from "../../../../graphql/context";
import type { PubSubChannels } from "../../../../graphql/pubsub";
import type { CampaignMemberService } from "../../../campaignMembers/application/CampaignMemberService";

function makeCampaignMemberService(): CampaignMemberService {
  return { getMembership: vi.fn() } as unknown as CampaignMemberService;
}

function makeContext(
  campaignMemberService: CampaignMemberService,
  currentUser: User | null,
  pubSub = createPubSub<PubSubChannels>(),
): GraphQLContext {
  return {
    campaignMemberService,
    currentUser,
    pubSub,
  } as GraphQLContext;
}

const loggedOutUser = null;

const targetedPlayer = User.create({
  email: "targeted-player@example.com",
  password: "hashed",
});
const otherPlayer = User.create({
  email: "other-player@example.com",
  password: "hashed",
});

const targetedPlayerMembership = CampaignMember.create({
  campaignId: "campaign-1",
  userId: targetedPlayer.Id,
  role: "PLAYER",
});
const otherPlayerMembership = CampaignMember.create({
  campaignId: "campaign-1",
  userId: otherPlayer.Id,
  role: "PLAYER",
});

const secretEntity = Entity.create({
  campaignId: "campaign-1",
  type: "npc",
  name: "Secret Villain",
  visibility: EntityVisibility.PRIVATE,
});

describe("entities Subscription.entityWindowForceOpened", () => {
  it("rejects with UNAUTHENTICATED when logged out", async () => {
    const campaignMemberService = makeCampaignMemberService();
    const context = makeContext(campaignMemberService, loggedOutUser);

    await expect(
      Subscription.entityWindowForceOpened.subscribe(
        undefined,
        { campaignId: "campaign-1" },
        context,
      ),
    ).rejects.toMatchObject({ extensions: { code: "UNAUTHENTICATED" } });
  });

  it("rejects with FORBIDDEN when not a member of the campaign", async () => {
    const campaignMemberService = makeCampaignMemberService();
    vi.mocked(campaignMemberService.getMembership).mockResolvedValue(null);
    const context = makeContext(campaignMemberService, targetedPlayer);

    await expect(
      Subscription.entityWindowForceOpened.subscribe(
        undefined,
        { campaignId: "campaign-1" },
        context,
      ),
    ).rejects.toMatchObject({ extensions: { code: "FORBIDDEN" } });
  });

  it("delivers the published entity to a targeted subscriber, including a PRIVATE-visibility entity", async () => {
    const campaignMemberService = makeCampaignMemberService();
    vi.mocked(campaignMemberService.getMembership).mockResolvedValue(
      targetedPlayerMembership,
    );
    const context = makeContext(campaignMemberService, targetedPlayer);

    const source = await Subscription.entityWindowForceOpened.subscribe(
      undefined,
      { campaignId: "campaign-1" },
      context,
    );
    const iterator = source[Symbol.asyncIterator]();

    // Start pulling first so the underlying event listener is attached
    // before we publish — the source is a lazy async generator, so nothing
    // subscribes to the pub/sub topic until it's actually pulled.
    const nextPromise = iterator.next();
    context.pubSub.publish("entityWindowForceOpened", "campaign-1", {
      entity: secretEntity,
      targetUserIds: [targetedPlayer.Id.toString()],
    });

    const { value, done } = await nextPromise;
    expect(done).toBe(false);
    // The resolved entity is delivered as-is — including its PRIVATE
    // visibility — proving the mutation's deliberate bypass actually
    // reaches a targeted subscriber rather than being silently dropped.
    expect(Subscription.entityWindowForceOpened.resolve(value)).toBe(
      secretEntity,
    );
    expect(Subscription.entityWindowForceOpened.resolve(value).Visibility).toBe(
      EntityVisibility.PRIVATE,
    );

    await iterator.return?.();
  });

  it("does not deliver to a campaign member who isn't in the target list", async () => {
    const campaignMemberService = makeCampaignMemberService();
    vi.mocked(campaignMemberService.getMembership).mockResolvedValue(
      otherPlayerMembership,
    );
    const context = makeContext(campaignMemberService, otherPlayer);

    const source = await Subscription.entityWindowForceOpened.subscribe(
      undefined,
      { campaignId: "campaign-1" },
      context,
    );
    const iterator = source[Symbol.asyncIterator]();

    let received = false;
    iterator.next().then(() => {
      received = true;
    });

    // Published for campaign-1, but targeted only at `targetedPlayer` — the
    // subscribing user here is `otherPlayer`.
    context.pubSub.publish("entityWindowForceOpened", "campaign-1", {
      entity: secretEntity,
      targetUserIds: [targetedPlayer.Id.toString()],
    });

    // Flush pending microtasks so a wrongly-delivered event would have had
    // a chance to settle `received`.
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(received).toBe(false);

    // Note: we deliberately don't call iterator.return() here — there's an
    // outstanding, never-resolving next() call in flight since nothing
    // matching this subscriber was ever yielded. Nothing leaks; the test
    // process tears down the iterator along with everything else.
  });

  it("does not deliver payloads published for a different campaign", async () => {
    const campaignMemberService = makeCampaignMemberService();
    vi.mocked(campaignMemberService.getMembership).mockResolvedValue(
      targetedPlayerMembership,
    );
    const context = makeContext(campaignMemberService, targetedPlayer);

    const source = await Subscription.entityWindowForceOpened.subscribe(
      undefined,
      { campaignId: "campaign-1" },
      context,
    );
    const iterator = source[Symbol.asyncIterator]();

    let received = false;
    iterator.next().then(() => {
      received = true;
    });

    context.pubSub.publish("entityWindowForceOpened", "campaign-2", {
      entity: secretEntity,
      targetUserIds: [targetedPlayer.Id.toString()],
    });

    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(received).toBe(false);
  });

  it("resolve passes the entity through unchanged", () => {
    expect(Subscription.entityWindowForceOpened.resolve(secretEntity)).toBe(
      secretEntity,
    );
  });
});
