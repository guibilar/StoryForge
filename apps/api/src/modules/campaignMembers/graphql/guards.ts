import {
  CampaignMember,
  ForbiddenError,
  hasPermission,
  PermissionAction,
} from "@storyforge/domain";
import { GraphQLContext } from "../../../graphql/context";
import { requireCurrentUser } from "../../auth/graphql/guards";

export async function requireCampaignMember(
  context: GraphQLContext,
  campaignId: string,
): Promise<CampaignMember> {
  const currentUser = requireCurrentUser(context);

  const membership = await context.campaignMemberService.getMembership(
    campaignId,
    currentUser.Id.toString(),
  );

  if (!membership) {
    throw new ForbiddenError("You are not a member of this campaign.");
  }

  return membership;
}

export async function requireCampaignRole(
  context: GraphQLContext,
  campaignId: string,
  action: PermissionAction,
): Promise<CampaignMember> {
  const membership = await requireCampaignMember(context, campaignId);

  if (!hasPermission(membership.Role, action)) {
    throw new ForbiddenError(
      "Your role does not allow you to perform this action.",
    );
  }

  return membership;
}

export async function requireCampaignWriter(
  context: GraphQLContext,
  campaignId: string,
): Promise<CampaignMember> {
  return requireCampaignRole(context, campaignId, "EDIT_ENTITY");
}

export async function requireCampaignBroadcaster(
  context: GraphQLContext,
  campaignId: string,
): Promise<CampaignMember> {
  return requireCampaignRole(context, campaignId, "BROADCAST_TO_PLAYERS");
}
