import { MapImage } from "./MapImage";

export interface MapImageRepository {
  findByCampaign(campaignId: string): Promise<MapImage | null>;

  upsert(mapImage: MapImage): Promise<void>;

  deleteByCampaign(campaignId: string): Promise<void>;
}
