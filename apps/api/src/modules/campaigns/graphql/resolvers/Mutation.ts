import type { GraphQLContext } from "../../../../graphql/context";
import { toGraphQLError } from "../../../../graphql/errors";
import { requireCurrentUser } from "../../../auth/graphql/guards";
import {
  CreateCampaignDTO,
  UpdateCampaignDTO,
} from "../../application/CampaignService";

export const Mutation = {
  createCampaign: async (
    _parent: unknown,
    args: { input: CreateCampaignDTO },
    context: GraphQLContext,
  ) => {
    try {
      requireCurrentUser(context);
      return await context.campaignService.createCampaign(args);
    } catch (error) {
      toGraphQLError(error);
    }
  },

  updateCampaign: async (
    _parent: unknown,
    args: { input: UpdateCampaignDTO },
    context: GraphQLContext,
  ) => {
    try {
      requireCurrentUser(context);
      return await context.campaignService.updateCampaign(args);
    } catch (error) {
      toGraphQLError(error);
    }
  },

  archiveCampaign: async (
    _parent: unknown,
    args: { id: string },
    context: GraphQLContext,
  ) => {
    try {
      requireCurrentUser(context);
      await context.campaignService.archiveCampaign(args.id);
      return true;
    } catch (error) {
      toGraphQLError(error);
    }
  },
};
