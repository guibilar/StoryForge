import type { GraphQLContext } from "../../../../graphql/context";
import { toGraphQLError } from "../../../../graphql/errors";
import { requireCurrentUser } from "../../../auth/graphql/guards";
import { requireCampaignMember } from "../../../campaignMembers/graphql/guards";

export interface CreateSessionInput {
  campaignId: string;
  date: string;
  summary?: string | null;
}

export interface UpdateSessionInput {
  id: string;
  date?: string;
  summary?: string | null;
}

export const Mutation = {
  createSession: async (
    _parent: unknown,
    args: { input: CreateSessionInput },
    context: GraphQLContext,
  ) => {
    try {
      await requireCampaignMember(context, args.input.campaignId);
      return await context.sessionService.createSession({
        campaignId: args.input.campaignId,
        date: new Date(args.input.date),
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
      await requireCampaignMember(context, session.CampaignId);
      return await context.sessionService.updateSession({
        id: args.input.id,
        date:
          args.input.date === undefined ? undefined : new Date(args.input.date),
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
      await requireCampaignMember(context, session.CampaignId);
      await context.sessionService.deleteSession(args.id);
      return true;
    } catch (error) {
      toGraphQLError(error);
    }
  },
};
