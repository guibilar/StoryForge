import {
  Relationship,
  RelationshipId,
  RelationshipRepository,
  ValidationError,
} from "@storyforge/domain";

import { prisma, Prisma } from "@storyforge/database";
import { RelationshipMapper } from "./RelationshipMapper";

export class PrismaRelationshipRepository implements RelationshipRepository {
  async findById(id: RelationshipId): Promise<Relationship | null> {
    const record = await prisma.relationship.findFirst({
      where: {
        id: id.toString(),
        deletedAt: null,
      },
    });

    if (!record) {
      return null;
    }

    return RelationshipMapper.toDomain(record);
  }

  async findByCampaign(campaignId: string): Promise<Relationship[]> {
    const records = await prisma.relationship.findMany({
      where: {
        campaignId,
        deletedAt: null,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    return records.map(RelationshipMapper.toDomain);
  }

  async findByEntity(
    campaignId: string,
    entityId: string,
  ): Promise<Relationship[]> {
    const records = await prisma.relationship.findMany({
      where: {
        campaignId,
        OR: [{ sourceEntityId: entityId }, { targetEntityId: entityId }],
        deletedAt: null,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    return records.map(RelationshipMapper.toDomain);
  }

  async existsByEdge(
    campaignId: string,
    sourceEntityId: string,
    targetEntityId: string,
    type: string,
  ): Promise<boolean> {
    const count = await prisma.relationship.count({
      where: {
        campaignId,
        sourceEntityId,
        targetEntityId,
        type,
        deletedAt: null,
      },
    });

    return count > 0;
  }

  async create(relationship: Relationship): Promise<void> {
    try {
      await prisma.relationship.create({
        data: RelationshipMapper.toPersistence(relationship),
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ValidationError(
          "A relationship of this type already exists between these entities.",
        );
      }
      throw error;
    }
  }

  async update(relationship: Relationship): Promise<void> {
    await prisma.relationship.update({
      where: {
        id: relationship.Id.toString(),
      },
      data: RelationshipMapper.toPersistence(relationship),
    });
  }
}
