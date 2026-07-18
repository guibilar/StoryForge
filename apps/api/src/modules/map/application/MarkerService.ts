import {
  Marker,
  MarkerId,
  MarkerRepository,
  EntityId,
  EntityRepository,
  NotFoundError,
  ValidationError,
} from "@storyforge/domain";

export interface CreateMarkerDto {
  campaignId: string;
  name: string;
  lat: number;
  lng: number;
  description?: string | null;
  entityId?: string | null;
}

export interface UpdateMarkerDto {
  id: string;
  name?: string;
  lat?: number;
  lng?: number;
  description?: string | null;
  entityId?: string | null;
}

export class MarkerService {
  constructor(
    private readonly repository: MarkerRepository,
    private readonly entityRepository: EntityRepository,
  ) {}

  async createMarker(dto: CreateMarkerDto): Promise<Marker> {
    if (dto.entityId) {
      await this.requireEntityInCampaign(dto.entityId, dto.campaignId);
    }

    const marker = Marker.create(dto);

    await this.repository.create(marker);

    return marker;
  }

  async updateMarker(dto: UpdateMarkerDto): Promise<Marker> {
    const marker = await this.getMarker(dto.id);

    if (dto.name !== undefined) {
      marker.rename(dto.name);
    }

    if (dto.lat !== undefined || dto.lng !== undefined) {
      marker.moveTo(dto.lat ?? marker.Lat, dto.lng ?? marker.Lng);
    }

    if (dto.description !== undefined) {
      marker.changeDescription(dto.description);
    }

    if (dto.entityId !== undefined) {
      if (dto.entityId) {
        // The update DTO carries no campaignId, so the campaign of record is
        // the existing aggregate's.
        await this.requireEntityInCampaign(dto.entityId, marker.CampaignId);
      }
      marker.linkEntity(dto.entityId);
    }

    await this.repository.update(marker);

    return marker;
  }

  async deleteMarker(id: string): Promise<void> {
    const markerId = MarkerId.fromString(id);
    const marker = await this.repository.findById(markerId);

    if (!marker) {
      throw new NotFoundError("Marker not found.");
    }

    await this.repository.delete(markerId);
  }

  async getMarker(id: string): Promise<Marker> {
    const marker = await this.repository.findById(MarkerId.fromString(id));

    if (!marker) {
      throw new NotFoundError("Marker not found.");
    }

    return marker;
  }

  async listMarkers(campaignId: string): Promise<Marker[]> {
    return this.repository.findByCampaign(campaignId);
  }

  private async requireEntityInCampaign(
    entityId: string,
    campaignId: string,
  ): Promise<void> {
    const entity = await this.entityRepository.findById(
      EntityId.fromString(entityId),
    );

    if (!entity) {
      throw new NotFoundError("Entity not found.");
    }

    if (entity.CampaignId !== campaignId) {
      throw new ValidationError("Entity does not belong to this campaign.");
    }
  }
}
