import { Campaign } from "./Campaign";
import { CampaignId } from "./CampaignId";

export interface CampaignRepository {
  findById(id: CampaignId): Promise<Campaign | null>;

  existsByName(name: string): Promise<boolean>;

  create(entity: Campaign): Promise<Campaign>;

  update(entity: Campaign): Promise<Campaign>;

  archive(campaign: Campaign): Promise<void>;

  listCampaigns(userId: string): Promise<Campaign[]>;
}
