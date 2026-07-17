import type { GraphQLContext } from "../../../../graphql/context";
import {
  parseOptionalDate,
  parseRequiredDate,
} from "../../../../graphql/dateInput";
import { toGraphQLError } from "../../../../graphql/errors";
import { requireCurrentUser } from "../../../auth/graphql/guards";
import { requireCampaignWriter } from "../../../campaignMembers/graphql/guards";

export interface CreateSessionInput {
  campaignId: string;
  date: string;
  summary?: string | null;
}

export interface UpdateSessionInput {
  id: string;
  date?: string | null;
  summary?: string | null;
}

export const Mutation = {
  createSession: async (
    _parent: unknown,
    args: { input: CreateSessionInput },
    context: GraphQLContext,
  ) => {
    try {
      await requireCampaignWriter(context, args.input.campaignId);
      return await context.sessionService.createSession({
        campaignId: args.input.campaignId,
        date: parseRequiredDate(args.input.date, "date"),
        summary: args.input.summary,
      });
    } catch (error) {
      toGraphQLError(error);
    }
  },

  updateSession: async (
    _parent: unknown,
    args: { input: UpdateSessionInput },
    context: GraphQLContext,
  ) => {
    try {
      requireCurrentUser(context);
      const session = await context.sessionService.getSession(args.input.id);
      await requireCampaignWriter(context, session.CampaignId);
      return await context.sessionService.updateSession({
        id: args.input.id,
        date: parseOptionalDate(args.input.date, "date"),
        summary: args.input.summary,
      });
    } catch (error) {
      toGraphQLError(error);
    }
  },

  deleteSession: async (
    _parent: unknown,
    args: { id: string },
    context: GraphQLContext,
  ) => {
    try {
      requireCurrentUser(context);
      const session = await context.sessionService.getSession(args.id);
      await requireCampaignWriter(context, session.CampaignId);
      await context.sessionService.deleteSession(args.id);
      return true;
    } catch (error) {
      toGraphQLError(error);
    }
  },
};
