import { MapImage, MapImageRepository } from "@storyforge/domain";

import { prisma } from "@storyforge/database";
import { MapImageMapper } from "./MapImageMapper";

export class PrismaMapImageRepository implements MapImageRepository {
  async findByCampaign(campaignId: string): Promise<MapImage | null> {
    const record = await prisma.mapImage.findUnique({
      where: { campaignId },
    });

    if (!record) {
      return null;
    }

    return MapImageMapper.toDomain(record);
  }

  async upsert(mapImage: MapImage): Promise<void> {
    const data = MapImageMapper.toPersistence(mapImage);

    await prisma.mapImage.upsert({
      where: { campaignId: data.campaignId },
      create: data,
      update: {
        url: data.url,
        fileName: data.fileName,
        mimeType: data.mimeType,
        sizeBytes: data.sizeBytes,
        width: data.width,
        height: data.height,
        updatedAt: data.updatedAt,
      },
    });
  }

  async deleteByCampaign(campaignId: string): Promise<void> {
    await prisma.mapImage.delete({ where: { campaignId } });
  }
}
