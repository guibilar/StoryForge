import {
  Entity,
  EntityFilter,
  EntityId,
  EntityRepository,
  ValidationError,
} from "@storyforge/domain";

import { prisma, Prisma } from "@storyforge/database";
import { EntityMapper } from "./EntityMapper";

export class PrismaEntityRepository implements EntityRepository {
  async findById(id: EntityId): Promise<Entity | null> {
    const record = await prisma.entity.findFirst({
      where: {
        id: id.toString(),
        deletedAt: null,
      },
    });

    if (!record) {
      return null;
    }

    return EntityMapper.toDomain(record);
  }

  async findByCampaign(
    campaignId: string,
    filter?: EntityFilter | null,
  ): Promise<Entity[]> {
    const where: Prisma.EntityWhereInput = {
      campaignId,
      deletedAt: null,
    };

    if (filter?.type) {
      where.type = filter.type;
    }

    if (filter?.category) {
      where.category = filter.category;
    }

    if (filter?.nameContains) {
      where.name = { contains: filter.nameContains, mode: "insensitive" };
    }

    if (filter?.tagIds && filter.tagIds.length > 0) {
      where.tags = { some: { tagId: { in: filter.tagIds } } };
    }

    const records = await prisma.entity.findMany({
      where,
      orderBy: {
        createdAt: "asc",
      },
    });

    return records.map(EntityMapper.toDomain);
  }

  async existsByName(campaignId: string, name: string): Promise<boolean> {
    const entity = await prisma.entity.findFirst({
      where: {
        campaignId,
        name,
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });

    return entity !== null;
  }

  async findByName(campaignId: string, name: string): Promise<Entity | null> {
    const record = await prisma.entity.findFirst({
      where: {
        campaignId,
        name,
        deletedAt: null,
      },
    });

    if (!record) {
      return null;
    }

    return EntityMapper.toDomain(record);
  }

  async create(entity: Entity): Promise<void> {
    try {
      await prisma.entity.create({
        data: EntityMapper.toPersistence(entity),
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ValidationError(
          `An entity with the name "${entity.Name}" already exists.`,
        );
      }
      throw error;
    }
  }

  async update(entity: Entity): Promise<void> {
    try {
      await prisma.entity.update({
        where: {
          id: entity.Id.toString(),
        },
        data: EntityMapper.toPersistence(entity),
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ValidationError(
          `An entity with the name "${entity.Name}" already exists.`,
        );
      }
      throw error;
    }
  }
}
