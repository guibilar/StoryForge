import { Campaign } from "./Campaign";
import { CampaignId } from "./CampaignId";

export interface CampaignRepository {
  findById(id: CampaignId): Promise<Campaign | null>;

  existsByName(name: string): Promise<boolean>;

  create(entity: Campaign): Promise<void>;

  update(entity: Campaign): Promise<void>;

  archive(campaign: Campaign): Promise<void>;
}
