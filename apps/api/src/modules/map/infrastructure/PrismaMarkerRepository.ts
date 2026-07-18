import { Marker, MarkerId, MarkerRepository } from "@storyforge/domain";

import { prisma } from "@storyforge/database";
import { MarkerMapper } from "./MarkerMapper";

export class PrismaMarkerRepository implements MarkerRepository {
  async findById(id: MarkerId): Promise<Marker | null> {
    const record = await prisma.marker.findUnique({
      where: { id: id.toString() },
    });

    if (!record) {
      return null;
    }

    return MarkerMapper.toDomain(record);
  }

  async findByCampaign(campaignId: string): Promise<Marker[]> {
    const records = await prisma.marker.findMany({
      where: { campaignId },
      orderBy: { createdAt: "asc" },
    });

    return records.map(MarkerMapper.toDomain);
  }

  async create(marker: Marker): Promise<void> {
    await prisma.marker.create({ data: MarkerMapper.toPersistence(marker) });
  }

  async update(marker: Marker): Promise<void> {
    await prisma.marker.update({
      where: { id: marker.Id.toString() },
      data: MarkerMapper.toPersistence(marker),
    });
  }

  async delete(id: MarkerId): Promise<void> {
    await prisma.marker.delete({ where: { id: id.toString() } });
  }
}
