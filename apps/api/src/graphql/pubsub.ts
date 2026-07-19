import { createPubSub } from "graphql-yoga";
import type { Entity } from "@storyforge/domain";

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
 * Payload emitted on the `entityWindowForceOpened` channel (KAN-132 —
 * Storyteller force-opens an entity window on targeted players' screens).
 *
 * `entity` is the fully resolved domain `Entity`, published as-is by the
 * `forceOpenEntityWindow` mutation resolver — the same object the normal
 * `entity`/`entities` queries return, deliberately WITHOUT running it
 * through `canViewVisibility`/`filterByVisibility` first (see the mutation
 * resolver for why: a Storyteller force-revealing a PRIVATE/STORYTELLER
 * entity to a player is the entire point of this feature). Carrying the
 * resolved entity directly on the payload — rather than just an
 * `entityId` — is what makes that bypass actually reach the client: a
 * subscriber re-fetching via the normal `entity(id)` query would be
 * correctly rejected by the visibility filter, silently defeating the
 * feature.
 *
 * `targetUserIds` is the fully-resolved set of recipient user ids (already
 * expanded from `allPlayers`/`userIds` at publish time) — the subscription
 * resolver filters delivery per-subscriber against this list so the
 * channel never broadcasts entity data to a non-targeted player.
 */
export interface EntityWindowForceOpenedPayload {
  entity: Entity;
  targetUserIds: string[];
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
  entityWindowForceOpened: [string, EntityWindowForceOpenedPayload];
};

/**
 * Single in-memory pub/sub instance for the whole API process. StoryForge
 * runs as a single instance, so no distributed/Redis-backed event target is
 * needed — see KAN-127.
 */
export const pubSub = createPubSub<PubSubChannels>();

export type PubSub = typeof pubSub;
