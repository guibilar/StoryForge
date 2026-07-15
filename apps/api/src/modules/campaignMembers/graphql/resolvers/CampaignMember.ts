import type { CampaignMember as DomainCampaignMember } from "@storyforge/domain";

export const CampaignMember = {
  id: (member: DomainCampaignMember) =>
    `${member.CampaignId}:${member.UserId.toString()}`,
  campaignId: (member: DomainCampaignMember) => member.CampaignId,
  userId: (member: DomainCampaignMember) => member.UserId.toString(),
  role: (member: DomainCampaignMember) => member.Role,
  createdAt: (member: DomainCampaignMember) => member.CreatedAt.toISOString(),
  updatedAt: (member: DomainCampaignMember) => member.UpdatedAt.toISOString(),
};
