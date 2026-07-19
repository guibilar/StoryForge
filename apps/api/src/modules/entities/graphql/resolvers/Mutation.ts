import { CampaignMember, ForbiddenError } from "@storyforge/domain";
import type { GraphQLContext } from "../../../../graphql/context";
import { toGraphQLError } from "../../../../graphql/errors";
import { requireCurrentUser } from "../../../auth/graphql/guards";
import {
  requireCampaignBroadcaster,
  requireCampaignWriter,
} from "../../../campaignMembers/graphql/guards";
import type {
  CreateEntityDto,
  UpdateEntityDto,
} from "../../application/EntityService";

export interface ForceOpenEntityWindowTargetInput {
  allPlayers: boolean;
  userIds: string[];
}

export interface ForceOpenEntityWindowInput {
  campaignId: string;
  entityId: string;
  target: ForceOpenEntityWindowTargetInput;
}

/**
 * Resolves a `ForceOpenEntityWindowTargetInput` down to a concrete list of
 * recipient user ids, against the campaign's *static* membership list (no
 * presence/online tracking — same "all players" semantics KAN-129's
 * viewport sync uses).
 *
 * - `allPlayers: true` targets every current PLAYER/OBSERVER member —
 *   Storytellers/Co-Storytellers/the Owner are never implicit recipients
 *   of their own broadcast.
 * - Otherwise, `userIds` is honored as given but intersected against the
 *   real membership list, so a stale or made-up id can never end up a
 *   "target" that leaks entity data nowhere a real client is listening.
 */
export function resolveForceOpenTargetUserIds(
  members: CampaignMember[],
  target: ForceOpenEntityWindowTargetInput,
): string[] {
  if (target.allPlayers) {
    return members
      .filter(
        (member) => member.Role === "PLAYER" || member.Role === "OBSERVER",
      )
      .map((member) => member.UserId.toString());
  }

  const memberIds = new Set(members.map((member) => member.UserId.toString()));

  return [...new Set(target.userIds)].filter((userId) => memberIds.has(userId));
}

export const Mutation = {
  createEntity: async (
    _parent: unknown,
    args: { input: CreateEntityDto },
    context: GraphQLContext,
  ) => {
    try {
      await requireCampaignWriter(context, args.input.campaignId);
      return await context.entityService.createEntity(args.input);
    } catch (error) {
      toGraphQLError(error);
    }
  },

  updateEntity: async (
    _parent: unknown,
    args: { input: UpdateEntityDto },
    context: GraphQLContext,
  ) => {
    try {
      requireCurrentUser(context);
      const entity = await context.entityService.getEntity(args.input.id);
      await requireCampaignWriter(context, entity.CampaignId);
      return await context.entityService.updateEntity(args.input);
    } catch (error) {
      toGraphQLError(error);
    }
  },

  deleteEntity: async (
    _parent: unknown,
    args: { id: string },
    context: GraphQLContext,
  ) => {
    try {
      requireCurrentUser(context);
      const entity = await context.entityService.getEntity(args.id);
      await requireCampaignWriter(context, entity.CampaignId);
      await context.entityService.deleteEntity(args.id);
      return true;
    } catch (error) {
      toGraphQLError(error);
    }
  },

  uploadEntityImage: async (
    _parent: unknown,
    args: { entityId: string; file: File },
    context: GraphQLContext,
  ) => {
    try {
      requireCurrentUser(context);
      const entity = await context.entityService.getEntity(args.entityId);
      await requireCampaignWriter(context, entity.CampaignId);
      const path = await context.imageStorage.save(args.entityId, args.file);

      return await context.entityService.setEntityImage(args.entityId, path);
    } catch (error) {
      toGraphQLError(error);
    }
  },

  forceOpenEntityWindow: async (
    _parent: unknown,
    args: { input: ForceOpenEntityWindowInput },
    context: GraphQLContext,
  ) => {
    try {
      const { campaignId, entityId, target } = args.input;

      await requireCampaignBroadcaster(context, campaignId);

      // Reuse the existing entity-loading path (do not reinvent entity
      // loading) — this is the same service method the `entity`/`entities`
      // queries call.
      const entity = await context.entityService.getEntity(entityId);

      if (entity.CampaignId !== campaignId) {
        throw new ForbiddenError(
          "Entity does not belong to the given campaign.",
        );
      }

      const members =
        await context.campaignMemberService.listMembers(campaignId);
      const targetUserIds = resolveForceOpenTargetUserIds(members, target);

      // INTENTIONAL VISIBILITY BYPASS (KAN-132): a normal entity read
      // (`entity`/`entities`) runs the result through
      // `canViewVisibility`/`filterByVisibility` so Players/Observers only
      // ever see PUBLIC entities. This mutation is a deliberate, product-
      // decided exception to that rule — a Storyteller can force-reveal a
      // STORYTELLER/PRIVATE-visibility entity (e.g. surprise-revealing a
      // secret NPC's stat block) by explicitly choosing to broadcast it.
      // `entity` above is published as-is, with NO visibility filtering
      // applied — do not "fix" this by adding a filter here, and do not
      // reintroduce it by having the subscription resolver re-fetch via
      // `entityService.getEntity`/the `entity` query instead of trusting
      // this published payload.
      context.pubSub.publish("entityWindowForceOpened", campaignId, {
        entity,
        targetUserIds,
      });

      return true;
    } catch (error) {
      toGraphQLError(error);
    }
  },
};
