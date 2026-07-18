import {
  NotFoundError,
  Territory,
  TerritoryGeometry,
  TerritoryId,
  TerritoryRepository,
} from "@storyforge/domain";

export interface CreateTerritoryDto {
  campaignId: string;
  name: string;
  type: string;
  geometry: TerritoryGeometry;
  description?: string | null;
}

export interface UpdateTerritoryDto {
  id: string;
  name?: string;
  type?: string;
  geometry?: TerritoryGeometry;
  description?: string | null;
}

export class TerritoryService {
  constructor(private readonly repository: TerritoryRepository) {}

  async createTerritory(dto: CreateTerritoryDto): Promise<Territory> {
    const territory = Territory.create(dto);

    await this.repository.create(territory);

    return territory;
  }

  async updateTerritory(dto: UpdateTerritoryDto): Promise<Territory> {
    const territory = await this.getTerritory(dto.id);

    if (dto.name !== undefined) {
      territory.rename(dto.name);
    }

    if (dto.type !== undefined) {
      territory.changeType(dto.type);
    }

    if (dto.geometry !== undefined) {
      territory.changeGeometry(dto.geometry);
    }

    if (dto.description !== undefined) {
      territory.changeDescription(dto.description);
    }

    await this.repository.update(territory);

    return territory;
  }

  async deleteTerritory(id: string): Promise<void> {
    const territoryId = TerritoryId.fromString(id);
    const territory = await this.repository.findById(territoryId);

    if (!territory) {
      throw new NotFoundError("Territory not found.");
    }

    await this.repository.delete(territoryId);
  }

  async getTerritory(id: string): Promise<Territory> {
    const territory = await this.repository.findById(
      TerritoryId.fromString(id),
    );

    if (!territory) {
      throw new NotFoundError("Territory not found.");
    }

    return territory;
  }

  async listTerritories(campaignId: string): Promise<Territory[]> {
    return this.repository.findByCampaign(campaignId);
  }
}
