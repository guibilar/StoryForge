import { CampaignMember, CampaignRole } from "./CampaignMember";
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

  /**
   * Atomically demotes the current OWNER (if any) to demotedRole and
   * promotes newOwnerUserId to OWNER, so the campaign never has zero or two
   * owners even under concurrent calls.
   */
  transferOwnership(
    campaignId: string,
    currentOwnerUserId: UserId | null,
    newOwnerUserId: UserId,
    demotedRole: CampaignRole,
  ): Promise<void>;
}
