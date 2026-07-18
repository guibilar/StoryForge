import {
  Marker,
  MarkerId,
  MarkerRepository,
  NotFoundError,
} from "@storyforge/domain";

export interface CreateMarkerDto {
  campaignId: string;
  name: string;
  lat: number;
  lng: number;
  description?: string | null;
}

export interface UpdateMarkerDto {
  id: string;
  name?: string;
  lat?: number;
  lng?: number;
  description?: string | null;
}

export class MarkerService {
  constructor(private readonly repository: MarkerRepository) {}

  async createMarker(dto: CreateMarkerDto): Promise<Marker> {
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
}
