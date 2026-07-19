import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPubSub } from "graphql-yoga";
import { CampaignMember, User } from "@storyforge/domain";
import {
  CAMPAIGN_BROADCAST_PING_INTERVAL_MS,
  Subscription,
} from "./Subscription";
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
const authenticatedUser = User.create({
  email: "user@example.com",
  password: "hashed",
});

const membership = CampaignMember.create({
  campaignId: "campaign-1",
  userId: authenticatedUser.Id,
  role: "PLAYER",
});

describe("campaignBroadcast Subscription.campaignBroadcast", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("rejects with UNAUTHENTICATED when logged out", async () => {
    const campaignMemberService = makeCampaignMemberService();
    const context = makeContext(campaignMemberService, loggedOutUser);

    await expect(
      Subscription.campaignBroadcast.subscribe(
        undefined,
        { campaignId: "campaign-1" },
        context,
      ),
    ).rejects.toMatchObject({ extensions: { code: "UNAUTHENTICATED" } });
  });

  it("rejects with FORBIDDEN when not a member of the campaign", async () => {
    const campaignMemberService = makeCampaignMemberService();
    vi.mocked(campaignMemberService.getMembership).mockResolvedValue(null);
    const context = makeContext(campaignMemberService, authenticatedUser);

    await expect(
      Subscription.campaignBroadcast.subscribe(
        undefined,
        { campaignId: "campaign-1" },
        context,
      ),
    ).rejects.toMatchObject({ extensions: { code: "FORBIDDEN" } });
  });

  it("delivers a published payload to a subscribed campaign member", async () => {
    const campaignMemberService = makeCampaignMemberService();
    vi.mocked(campaignMemberService.getMembership).mockResolvedValue(
      membership,
    );
    const context = makeContext(campaignMemberService, authenticatedUser);

    const source = await Subscription.campaignBroadcast.subscribe(
      undefined,
      { campaignId: "campaign-1" },
      context,
    );
    const iterator = source[Symbol.asyncIterator]();

    // Start pulling first so the underlying event listener is attached
    // before we publish — the source is a lazy async generator, so nothing
    // subscribes to the pub/sub topic until it's actually pulled.
    const nextPromise = iterator.next();
    context.pubSub.publish("campaignBroadcast", "campaign-1", {
      message: "hello",
      emittedAt: "2026-07-19T00:00:00.000Z",
    });

    const { value, done } = await nextPromise;
    expect(done).toBe(false);
    expect(Subscription.campaignBroadcast.resolve(value)).toEqual({
      message: "hello",
      emittedAt: "2026-07-19T00:00:00.000Z",
    });

    await iterator.return?.();
  });

  it("does not deliver payloads published for a different campaign", async () => {
    const campaignMemberService = makeCampaignMemberService();
    vi.mocked(campaignMemberService.getMembership).mockResolvedValue(
      membership,
    );
    const context = makeContext(campaignMemberService, authenticatedUser);

    const source = await Subscription.campaignBroadcast.subscribe(
      undefined,
      { campaignId: "campaign-1" },
      context,
    );
    const iterator = source[Symbol.asyncIterator]();

    let received = false;
    // Start pulling first so the underlying event listener is attached
    // before we publish — see the note in the previous test.
    iterator.next().then(() => {
      received = true;
    });

    context.pubSub.publish("campaignBroadcast", "campaign-2", {
      message: "hello",
      emittedAt: "2026-07-19T00:00:00.000Z",
    });
    // Flush pending microtasks without advancing fake time, so a
    // wrongly-delivered event would have had a chance to settle `received`.
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(received).toBe(false);

    // Note: we deliberately don't call `iterator.return()` here — there's
    // still an outstanding, never-resolving `next()` call in flight (the one
    // waiting on the campaign-1 topic), and per the async iterator protocol
    // a `return()` call queues behind it instead of cancelling it. Fake
    // timers are torn down in `afterEach`, so nothing actually leaks.
  });

  it("emits a heartbeat on the ping interval while subscribed", async () => {
    const campaignMemberService = makeCampaignMemberService();
    vi.mocked(campaignMemberService.getMembership).mockResolvedValue(
      membership,
    );
    const context = makeContext(campaignMemberService, authenticatedUser);

    const source = await Subscription.campaignBroadcast.subscribe(
      undefined,
      { campaignId: "campaign-1" },
      context,
    );
    const iterator = source[Symbol.asyncIterator]();

    const nextPromise = iterator.next();
    await vi.advanceTimersByTimeAsync(CAMPAIGN_BROADCAST_PING_INTERVAL_MS);
    const { value, done } = await nextPromise;

    expect(done).toBe(false);
    expect(Subscription.campaignBroadcast.resolve(value).message).toBe("ping");

    await iterator.return?.();
  });
});
