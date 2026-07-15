import type { GraphQLContext } from "../../../../graphql/context";
import { toGraphQLError } from "../../../../graphql/errors";
import { requireCampaignOwner } from "../guards";
import {
  AddCampaignMemberDto,
  UpdateCampaignMemberRoleDto,
} from "../../application/CampaignMemberService";

export const Mutation = {
  addCampaignMember: async (
    _parent: unknown,
    args: { input: AddCampaignMemberDto },
    context: GraphQLContext,
  ) => {
    try {
      await requireCampaignOwner(context, args.input.campaignId);
      return await context.campaignMemberService.addMember(args.input);
    } catch (error) {
      toGraphQLError(error);
    }
  },

  removeCampaignMember: async (
    _parent: unknown,
    args: { campaignId: string; userId: string },
    context: GraphQLContext,
  ) => {
    try {
      await requireCampaignOwner(context, args.campaignId);
      await context.campaignMemberService.removeMember(
        args.campaignId,
        args.userId,
      );
      return true;
    } catch (error) {
      toGraphQLError(error);
    }
  },

  updateCampaignMemberRole: async (
    _parent: unknown,
    args: { input: UpdateCampaignMemberRoleDto },
    context: GraphQLContext,
  ) => {
    try {
      await requireCampaignOwner(context, args.input.campaignId);
      return await context.campaignMemberService.updateMemberRole(args.input);
    } catch (error) {
      toGraphQLError(error);
    }
  },
};
