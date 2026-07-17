import { ValidationError } from "@storyforge/domain";
import type { GraphQLContext } from "../../../../graphql/context";
import { toGraphQLError } from "../../../../graphql/errors";
import { requireCurrentUser } from "../../../auth/graphql/guards";
import { requireCampaignWriter } from "../../../campaignMembers/graphql/guards";

function normalizeOptionalOccurredAt(
  value: string | null | undefined,
): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    throw new ValidationError("occurredAt cannot be null.");
  }

  return value;
}

export interface CreateEventInput {
  campaignId: string;
  sessionId?: string | null;
  title: string;
  description?: string | null;
  occurredAt: string;
}

export interface UpdateEventInput {
  id: string;
  sessionId?: string | null;
  title?: string;
  description?: string | null;
  occurredAt?: string | null;
}

export const Mutation = {
  createEvent: async (
    _parent: unknown,
    args: { input: CreateEventInput },
    context: GraphQLContext,
  ) => {
    try {
      await requireCampaignWriter(context, args.input.campaignId);
      return await context.eventService.createEvent({
        campaignId: args.input.campaignId,
        sessionId: args.input.sessionId,
        title: args.input.title,
        description: args.input.description,
        occurredAt: args.input.occurredAt,
      });
    } catch (error) {
      toGraphQLError(error);
    }
  },

  updateEvent: async (
    _parent: unknown,
    args: { input: UpdateEventInput },
    context: GraphQLContext,
  ) => {
    try {
      requireCurrentUser(context);
      const event = await context.eventService.getEvent(args.input.id);
      await requireCampaignWriter(context, event.CampaignId);
      return await context.eventService.updateEvent({
        id: args.input.id,
        sessionId: args.input.sessionId,
        title: args.input.title,
        description: args.input.description,
        occurredAt: normalizeOptionalOccurredAt(args.input.occurredAt),
      });
    } catch (error) {
      toGraphQLError(error);
    }
  },

  deleteEvent: async (
    _parent: unknown,
    args: { id: string },
    context: GraphQLContext,
  ) => {
    try {
      requireCurrentUser(context);
      const event = await context.eventService.getEvent(args.id);
      await requireCampaignWriter(context, event.CampaignId);
      await context.eventService.deleteEvent(args.id);
      return true;
    } catch (error) {
      toGraphQLError(error);
    }
  },

  attachParticipant: async (
    _parent: unknown,
    args: { eventId: string; entityId: string; role?: string | null },
    context: GraphQLContext,
  ) => {
    try {
      requireCurrentUser(context);
      const event = await context.eventService.getEvent(args.eventId);
      await requireCampaignWriter(context, event.CampaignId);
      return await context.eventService.attachParticipant(
        args.eventId,
        args.entityId,
        args.role,
      );
    } catch (error) {
      toGraphQLError(error);
    }
  },

  detachParticipant: async (
    _parent: unknown,
    args: { eventId: string; entityId: string },
    context: GraphQLContext,
  ) => {
    try {
      requireCurrentUser(context);
      const event = await context.eventService.getEvent(args.eventId);
      await requireCampaignWriter(context, event.CampaignId);
      return await context.eventService.detachParticipant(
        args.eventId,
        args.entityId,
      );
    } catch (error) {
      toGraphQLError(error);
    }
  },
};
