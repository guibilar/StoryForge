import { Tag, TagId, TagRepository } from "@storyforge/domain";

import { prisma } from "@storyforge/database";
import { TagMapper } from "./TagMapper";

export class PrismaTagRepository implements TagRepository {
  async findById(id: TagId): Promise<Tag | null> {
    const record = await prisma.tag.findUnique({
      where: {
        id: id.toString(),
      },
    });

    if (!record) {
      return null;
    }

    return TagMapper.toDomain(record);
  }

  async findByCampaign(campaignId: string): Promise<Tag[]> {
    const records = await prisma.tag.findMany({
      where: {
        campaignId,
      },
      orderBy: {
        name: "asc",
      },
    });

    return records.map(TagMapper.toDomain);
  }

  async findByCampaignAndName(
    campaignId: string,
    name: string,
  ): Promise<Tag | null> {
    const record = await prisma.tag.findFirst({
      where: {
        campaignId,
        name,
      },
    });

    if (!record) {
      return null;
    }

    return TagMapper.toDomain(record);
  }

  async findByEntity(entityId: string): Promise<Tag[]> {
    const records = await prisma.tag.findMany({
      where: {
        entities: {
          some: {
            entityId,
          },
        },
      },
    });

    return records.map(TagMapper.toDomain);
  }

  async create(entity: Tag): Promise<void> {
    await prisma.tag.create({
      data: TagMapper.toPersistence(entity),
    });
  }

  async attachToEntity(tagId: TagId, entityId: string): Promise<void> {
    const existing = await prisma.entityTag.findFirst({
      where: { tagId: tagId.toString(), entityId },
    });

    if (existing) return;

    await prisma.entityTag.create({
      data: { tagId: tagId.toString(), entityId },
    });
  }

  async detachFromEntity(tagId: TagId, entityId: string): Promise<void> {
    await prisma.entityTag.deleteMany({
      where: { tagId: tagId.toString(), entityId },
    });
  }
}
