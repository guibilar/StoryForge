import { Session, SessionId, SessionRepository } from "@storyforge/domain";

import { prisma } from "@storyforge/database";
import { SessionMapper } from "./SessionMapper";

export class PrismaSessionRepository implements SessionRepository {
  async findById(id: SessionId): Promise<Session | null> {
    const record = await prisma.session.findUnique({
      where: {
        id: id.toString(),
      },
    });

    if (!record) {
      return null;
    }

    return SessionMapper.toDomain(record);
  }

  async findByCampaign(campaignId: string): Promise<Session[]> {
    const records = await prisma.session.findMany({
      where: {
        campaignId,
      },
      orderBy: {
        sessionNumber: "asc",
      },
    });

    return records.map(SessionMapper.toDomain);
  }

  async findMaxSessionNumber(campaignId: string): Promise<number> {
    const result = await prisma.session.aggregate({
      where: {
        campaignId,
      },
      _max: {
        sessionNumber: true,
      },
    });

    return result._max.sessionNumber ?? 0;
  }

  async create(session: Session): Promise<void> {
    await prisma.session.create({
      data: SessionMapper.toPersistence(session),
    });
  }

  async update(session: Session): Promise<void> {
    await prisma.session.update({
      where: {
        id: session.Id.toString(),
      },
      data: SessionMapper.toPersistence(session),
    });
  }

  async delete(id: SessionId): Promise<void> {
    await prisma.session.delete({
      where: {
        id: id.toString(),
      },
    });
  }
}
