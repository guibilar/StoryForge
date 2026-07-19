import { describe, expect, it, vi } from "vitest";
import { createPubSub } from "graphql-yoga";
import { CampaignMember, User } from "@storyforge/domain";
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

const targetedMembership = CampaignMember.create({
  campaignId: "campaign-1",
  userId: targetedPlayer.Id,
  role: "PLAYER",
});
const otherMembership = CampaignMember.create({
  campaignId: "campaign-1",
  userId: otherPlayer.Id,
  role: "PLAYER",
});

const basePayload = {
  campaignId: "campaign-1",
  center: { lat: 12, lng: 34 },
  zoom: 9,
  broadcasterId: "storyteller-1",
};

describe("map Subscription.forceSyncViewport", () => {
  it("rejects with UNAUTHENTICATED when logged out", async () => {
    const campaignMemberService = makeCampaignMemberService();
    const context = makeContext(campaignMemberService, loggedOutUser);

    await expect(
      Subscription.forceSyncViewport.subscribe(
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
      Subscription.forceSyncViewport.subscribe(
        undefined,
        { campaignId: "campaign-1" },
        context,
      ),
    ).rejects.toMatchObject({ extensions: { code: "FORBIDDEN" } });
  });

  it("delivers the payload to a subscriber included in targetUserIds", async () => {
    const campaignMemberService = makeCampaignMemberService();
    vi.mocked(campaignMemberService.getMembership).mockResolvedValue(
      targetedMembership,
    );
    const context = makeContext(campaignMemberService, targetedPlayer);

    const source = await Subscription.forceSyncViewport.subscribe(
      undefined,
      { campaignId: "campaign-1" },
      context,
    );
    const iterator = source[Symbol.asyncIterator]();

    // Pull first so the underlying pub/sub listener attaches before we
    // publish — the source is a lazy async generator.
    const nextPromise = iterator.next();
    context.pubSub.publish("forceSyncViewport", "campaign-1", {
      ...basePayload,
      targetUserIds: [targetedPlayer.Id.toString()],
    });

    const { value, done } = await nextPromise;
    expect(done).toBe(false);
    expect(Subscription.forceSyncViewport.resolve(value)).toEqual(basePayload);

    await iterator.return?.();
  });

  it("does NOT deliver the payload to a subscriber not included in targetUserIds", async () => {
    const campaignMemberService = makeCampaignMemberService();
    vi.mocked(campaignMemberService.getMembership).mockResolvedValue(
      otherMembership,
    );
    const context = makeContext(campaignMemberService, otherPlayer);

    const source = await Subscription.forceSyncViewport.subscribe(
      undefined,
      { campaignId: "campaign-1" },
      context,
    );
    const iterator = source[Symbol.asyncIterator]();

    let received = false;
    iterator.next().then(() => {
      received = true;
    });

    // Addressed only to targetedPlayer, not otherPlayer, who is also
    // subscribed to the same campaign-scoped channel.
    context.pubSub.publish("forceSyncViewport", "campaign-1", {
      ...basePayload,
      targetUserIds: [targetedPlayer.Id.toString()],
    });

    // Flush pending microtasks so a wrongly-delivered event would have had
    // a chance to settle `received`.
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(received).toBe(false);

    // The untargeted subscriber's `next()` call is left permanently
    // pending (the filtering generator keeps waiting on the next payload) —
    // there's nothing to cancel safely here without racing the assertion,
    // same tradeoff the campaignBroadcast reference test makes.
  });

  it("does not deliver payloads published for a different campaign", async () => {
    const campaignMemberService = makeCampaignMemberService();
    vi.mocked(campaignMemberService.getMembership).mockResolvedValue(
      targetedMembership,
    );
    const context = makeContext(campaignMemberService, targetedPlayer);

    const source = await Subscription.forceSyncViewport.subscribe(
      undefined,
      { campaignId: "campaign-1" },
      context,
    );
    const iterator = source[Symbol.asyncIterator]();

    let received = false;
    iterator.next().then(() => {
      received = true;
    });

    context.pubSub.publish("forceSyncViewport", "campaign-2", {
      ...basePayload,
      campaignId: "campaign-2",
      targetUserIds: [targetedPlayer.Id.toString()],
    });

    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(received).toBe(false);
  });

  it("delivers to every subscriber included when targeting multiple userIds", async () => {
    const campaignMemberServiceA = makeCampaignMemberService();
    vi.mocked(campaignMemberServiceA.getMembership).mockResolvedValue(
      targetedMembership,
    );
    const campaignMemberServiceB = makeCampaignMemberService();
    vi.mocked(campaignMemberServiceB.getMembership).mockResolvedValue(
      otherMembership,
    );
    const sharedPubSub = createPubSub<PubSubChannels>();
    const contextA = makeContext(
      campaignMemberServiceA,
      targetedPlayer,
      sharedPubSub,
    );
    const contextB = makeContext(
      campaignMemberServiceB,
      otherPlayer,
      sharedPubSub,
    );

    const sourceA = await Subscription.forceSyncViewport.subscribe(
      undefined,
      { campaignId: "campaign-1" },
      contextA,
    );
    const sourceB = await Subscription.forceSyncViewport.subscribe(
      undefined,
      { campaignId: "campaign-1" },
      contextB,
    );
    const iteratorA = sourceA[Symbol.asyncIterator]();
    const iteratorB = sourceB[Symbol.asyncIterator]();

    const nextA = iteratorA.next();
    let receivedB = false;
    iteratorB.next().then(() => {
      receivedB = true;
    });

    sharedPubSub.publish("forceSyncViewport", "campaign-1", {
      ...basePayload,
      targetUserIds: [targetedPlayer.Id.toString(), otherPlayer.Id.toString()],
    });

    const { done } = await nextA;
    expect(done).toBe(false);
    await Promise.resolve();
    await Promise.resolve();
    expect(receivedB).toBe(true);

    await iteratorA.return?.();
    await iteratorB.return?.();
  });
});
