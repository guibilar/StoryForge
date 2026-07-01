import {
    Entity,
    EntityId,
    EntityRepository,
} from "@storyforge/domain";

import { prisma } from "@storyforge/database";
import { EntityMapper } from "./EntityMapper";

export class PrismaEntityRepository implements EntityRepository {

    async findById(id: EntityId): Promise<Entity | null> {
        const record = await prisma.entity.findUnique({
            where: {
                id: id.toString(),
            },
        });

        if (!record) {
            return null;
        }

        return EntityMapper.toDomain(record);
    }

    async findByCampaign(campaignId: string): Promise<Entity[]> {
        const records = await prisma.entity.findMany({
            where: {
                campaignId,
                deletedAt: null,
            },
            orderBy: {
                createdAt: "asc"
            }
        });

        return records.map(EntityMapper.toDomain);
    }

    async existsByName(
        campaignId: string,
        name: string,
    ): Promise<boolean> {
        const entity = await prisma.entity.findFirst({
            where: {
                campaignId,
                name,
                deletedAt: null,
            },
            select: {
                id: true
            }
        });

        return entity !== null
    }

    async create(entity: Entity): Promise<void> {
        await prisma.entity.create({
            data: EntityMapper.toPersistence(entity),
        });
    }

    async update(entity: Entity): Promise<void> {
        await prisma.entity.update({
            where: {
                id: entity.Id.toString(),
            },
            data: EntityMapper.toPersistence(entity),
        });
    }
}