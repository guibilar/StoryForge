import { createPubSub } from "graphql-yoga";

/**
 * Payload emitted on the `campaignBroadcast` channel. This is the trivial
 * proof-of-concept payload for KAN-127 (real-time transport foundation) —
 * it is intentionally NOT related to `packages/domain`'s `Event` concept
 * (an in-game timeline entry). Feature tickets built on top of this
 * transport (e.g. KAN-129, KAN-132) should add their own channel keys to
 * `PubSubChannels` below rather than overload this payload shape.
 */
export interface CampaignBroadcastPayload {
  message: string;
  emittedAt: string;
}

/**
 * Map of pub/sub channel name to a `[scopeId, payload]` tuple. Using the
 * `[scopeId, payload]` shape (rather than baking the scope into the channel
 * name as a string) lets `graphql-yoga`'s `createPubSub` filter delivery by
 * id natively: `pubSub.subscribe("campaignBroadcast", campaignId)` only
 * receives events published via
 * `pubSub.publish("campaignBroadcast", campaignId, payload)` for that same
 * campaign. This is how "scoped per campaign" is enforced for every channel
 * added here.
 */
export type PubSubChannels = {
  campaignBroadcast: [string, CampaignBroadcastPayload];
};

/**
 * Single in-memory pub/sub instance for the whole API process. StoryForge
 * runs as a single instance, so no distributed/Redis-backed event target is
 * needed — see KAN-127.
 */
export const pubSub = createPubSub<PubSubChannels>();

export type PubSub = typeof pubSub;
