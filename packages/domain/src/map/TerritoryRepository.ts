import { Territory } from "./Territory";
import { TerritoryId } from "./TerritoryId";

export interface TerritoryRepository {
  findById(id: TerritoryId): Promise<Territory | null>;

  findByCampaign(campaignId: string): Promise<Territory[]>;

  create(territory: Territory): Promise<void>;

  update(territory: Territory): Promise<void>;

  delete(id: TerritoryId): Promise<void>;
}
