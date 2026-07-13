import {
  Relationship,
  RelationshipId,
  RelationshipRepository,
  RelationshipType,
} from "@storyforge/domain";

import { prisma } from "@storyforge/database";
import { RelationshipMapper } from "./RelationshipMapper";

export class PrismaRelationshipRepository implements RelationshipRepository {
  async findById(id: RelationshipId): Promise<Relationship | null> {
    const record = await prisma.relationship.findUnique({
      where: {
        id: id.toString(),
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

  async findByEntity(entityId: string): Promise<Relationship[]> {
    const records = await prisma.relationship.findMany({
      where: {
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
    type: RelationshipType,
  ): Promise<boolean> {
    const count = await prisma.relationship.count({
      where: { campaignId, sourceEntityId, targetEntityId, type },
    });

    return count > 0;
  }

  async create(relationship: Relationship): Promise<void> {
    await prisma.relationship.create({
      data: RelationshipMapper.toPersistence(relationship),
    });
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
