import { CampaignMember } from "./CampaignMember";
import { UserId } from "../user";

export interface CampaignMemberRepository {
  listByCampaign(campaignId: string): Promise<CampaignMember[]>;

  findByCampaignAndUser(
    campaignId: string,
    userId: UserId,
  ): Promise<CampaignMember | null>;

  create(member: CampaignMember): Promise<void>;

  update(member: CampaignMember): Promise<void>;

  delete(campaignId: string, userId: UserId): Promise<void>;
}
