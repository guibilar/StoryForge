import { Marker } from "./Marker";
import { MarkerId } from "./MarkerId";

export interface MarkerRepository {
  findById(id: MarkerId): Promise<Marker | null>;

  findByCampaign(campaignId: string): Promise<Marker[]>;

  create(marker: Marker): Promise<void>;

  update(marker: Marker): Promise<void>;

  delete(id: MarkerId): Promise<void>;
}
