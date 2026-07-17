import { Tag, TagId, TagRepository } from "@storyforge/domain";

import { prisma, Prisma } from "@storyforge/database";
import { TagMapper } from "./TagMapper";

function isUniqueConstraintViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

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
    try {
      await prisma.tag.create({
        data: TagMapper.toPersistence(entity),
      });
    } catch (error) {
      // Someone else's concurrent create won the (campaignId, name) race —
      // the caller re-fetches by name afterwards, so this is a no-op, not a
      // failure.
      if (!isUniqueConstraintViolation(error)) {
        throw error;
      }
    }
  }

  async attachToEntity(tagId: TagId, entityId: string): Promise<void> {
    try {
      await prisma.entityTag.create({
        data: { tagId: tagId.toString(), entityId },
      });
    } catch (error) {
      // Already attached — a concurrent call won the (entityId, tagId)
      // race, which is the idempotent outcome this method promises.
      if (!isUniqueConstraintViolation(error)) {
        throw error;
      }
    }
  }

  async detachFromEntity(tagId: TagId, entityId: string): Promise<void> {
    await prisma.entityTag.deleteMany({
      where: { tagId: tagId.toString(), entityId },
    });
  }
}
