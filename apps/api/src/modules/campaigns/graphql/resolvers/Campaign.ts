import { Campaign as DomainCampaign } from "@storyforge/domain";
import type { GraphQLContext } from "../../../../graphql/context";

export const Campaign = {
  id: (campaign: DomainCampaign) => campaign.Id.toString(),
  name: (campaign: DomainCampaign) => campaign.Name,
  description: (campaign: DomainCampaign) => campaign.Description,
  createdAt: (campaign: DomainCampaign) => campaign.CreatedAt.toISOString(),
  updatedAt: (campaign: DomainCampaign) => campaign.UpdatedAt.toISOString(),
  archivedAt: (campaign: DomainCampaign) =>
    campaign.ArchivedAt?.toISOString() ?? null,
  members: (
    campaign: DomainCampaign,
    _args: unknown,
    context: GraphQLContext,
  ) => context.campaignMemberService.listMembers(campaign.Id.toString()),
};
