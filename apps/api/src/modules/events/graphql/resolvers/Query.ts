import type { GraphQLContext } from "../../../../graphql/context";
import { toGraphQLError } from "../../../../graphql/errors";
import { requireCurrentUser } from "../../../auth/graphql/guards";
import { requireCampaignMember } from "../../../campaignMembers/graphql/guards";

export const Query = {
  event: async (
    _parent: unknown,
    args: { id: string },
    context: GraphQLContext,
  ) => {
    try {
      requireCurrentUser(context);
      const event = await context.eventService.getEvent(args.id);
      await requireCampaignMember(context, event.CampaignId);
      return event;
    } catch (error) {
      toGraphQLError(error);
    }
  },

  events: async (
    _parent: unknown,
    args: { campaignId: string },
    context: GraphQLContext,
  ) => {
    try {
      await requireCampaignMember(context, args.campaignId);
      return await context.eventService.listEvents(args.campaignId);
    } catch (error) {
      toGraphQLError(error);
    }
  },

  eventsBySession: async (
    _parent: unknown,
    args: { sessionId: string },
    context: GraphQLContext,
  ) => {
    try {
      requireCurrentUser(context);
      const session = await context.sessionService.getSession(args.sessionId);
      await requireCampaignMember(context, session.CampaignId);
      return await context.eventService.listEventsBySession(args.sessionId);
    } catch (error) {
      toGraphQLError(error);
    }
  },
};
