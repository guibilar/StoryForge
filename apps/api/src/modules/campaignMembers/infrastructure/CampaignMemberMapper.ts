import { CampaignMember, UserId } from "@storyforge/domain";
import type { CampaignMember as PrismaCampaignMember } from "@storyforge/database";

export class CampaignMemberMapper {
  static toDomain(record: PrismaCampaignMember): CampaignMember {
    return CampaignMember.rehydrate({
      campaignId: record.campaignId,
      userId: UserId.fromString(record.userId),
      role: record.role,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }

  static toPersistence(member: CampaignMember) {
    return {
      campaignId: member.CampaignId,
      userId: member.UserId.toString(),
      role: member.Role,
      createdAt: member.CreatedAt,
      updatedAt: member.UpdatedAt,
    };
  }
}
