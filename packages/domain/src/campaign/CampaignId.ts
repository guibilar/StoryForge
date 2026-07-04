import { Id } from "../shared/Id";

export type CampaignId = Id<"Campaign">;

export const CampaignId = {
  create: (): CampaignId => Id.create<"Campaign">(),
  fromString: (value: string): CampaignId => Id.fromString<"Campaign">(value),
};
