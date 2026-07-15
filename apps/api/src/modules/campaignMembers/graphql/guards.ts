import { CampaignMember, ForbiddenError } from "@storyforge/domain";
import { GraphQLContext } from "../../../graphql/context";
import { requireCurrentUser } from "../../auth/graphql/guards";

export async function requireCampaignOwner(
  context: GraphQLContext,
  campaignId: string,
): Promise<void> {
  const currentUser = requireCurrentUser(context);

  const membership = await context.campaignMemberService.getMembership(
    campaignId,
    currentUser.Id.toString(),
  );

  if (!membership || membership.Role !== "OWNER") {
    throw new ForbiddenError(
      "Only the campaign owner can perform this action.",
    );
  }
}

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
