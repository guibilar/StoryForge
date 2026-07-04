import { NotFoundError, ValidationError } from "@storyforge/domain";
import { Campaign, CampaignId, CampaignRepository } from "@storyforge/domain";

export interface CreateCampaignDTO {
  name: string;
  description: string;
}

export interface UpdateCampaignDTO {
  id: string;
  name?: string;
  description?: string | null;
}

export class CampaignService {
  constructor(private readonly campaignRepository: CampaignRepository) {}

  async createCampaign({
    input: dto,
  }: {
    input: CreateCampaignDTO;
  }): Promise<Campaign> {
    const existingCampaign = await this.campaignRepository.existsByName(
      dto.name,
    );
    if (existingCampaign) {
      throw new ValidationError(
        `A campaign with the name "${dto.name}" already exists.`,
      );
    }

    const campaign = Campaign.create(dto);

    return await this.campaignRepository.create(campaign);
  }

  async getCampaignById(id: string): Promise<Campaign | null> {
    return this.campaignRepository.findById(CampaignId.fromString(id));
  }

  async updateCampaign({
    input: dto,
  }: {
    input: UpdateCampaignDTO;
  }): Promise<Campaign> {
    const campaign = await this.getCampaignById(dto.id);
    if (!campaign) {
      throw new NotFoundError(`Campaign with ID "${dto.id}" not found.`);
    }

    if (dto.name && dto.name !== undefined) campaign.rename(dto.name);

    if (dto.description !== undefined)
      campaign.changeDescription(dto.description);

    return await this.campaignRepository.update(campaign);
  }

  async archiveCampaign(id: string): Promise<void> {
    const campaign = await this.getCampaignById(id);
    if (!campaign) {
      throw new NotFoundError(`Campaign with ID "${id}" not found.`);
    }

    if (campaign.ArchivedAt) {
      throw new ValidationError(
        `Campaign with ID "${id}" is already archived.`,
      );
    }

    if (!campaign.Members.some((m) => m.Role === "OWNER")) {
      throw new ValidationError(
        `Cannot archive campaign with ID "${id}" because it has no owner.`,
      );
    }

    campaign.archive();

    await this.campaignRepository.archive(campaign);
  }

  async listCampaigns(): Promise<Campaign[]> {
    return this.campaignRepository.listCampaigns();
  }
}
