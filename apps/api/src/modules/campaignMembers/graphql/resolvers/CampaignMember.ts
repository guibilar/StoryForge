import type { CampaignMember as DomainCampaignMember } from "@storyforge/domain";
import type { GraphQLContext } from "../../../../graphql/context";

export const CampaignMember = {
  id: (member: DomainCampaignMember) =>
    `${member.CampaignId}:${member.UserId.toString()}`,
  campaignId: (member: DomainCampaignMember) => member.CampaignId,
  userId: (member: DomainCampaignMember) => member.UserId.toString(),
  user: (
    member: DomainCampaignMember,
    _args: unknown,
    context: GraphQLContext,
  ) => context.userRepository.findById(member.UserId),
  role: (member: DomainCampaignMember) => member.Role,
  createdAt: (member: DomainCampaignMember) => member.CreatedAt.toISOString(),
  updatedAt: (member: DomainCampaignMember) => member.UpdatedAt.toISOString(),
};
