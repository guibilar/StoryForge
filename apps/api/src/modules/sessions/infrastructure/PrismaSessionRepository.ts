import {
  Session,
  SessionId,
  SessionRepository,
  ValidationError,
} from "@storyforge/domain";

import { prisma, Prisma } from "@storyforge/database";
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
    try {
      await prisma.session.create({
        data: SessionMapper.toPersistence(session),
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ValidationError(
          "Another session was logged for this campaign at the same time. Please try again.",
        );
      }
      throw error;
    }
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

  async attachAttendee(sessionId: SessionId, userId: string): Promise<void> {
    await prisma.sessionAttendee.upsert({
      where: {
        sessionId_userId: { sessionId: sessionId.toString(), userId },
      },
      create: { sessionId: sessionId.toString(), userId },
      update: {},
    });
  }

  async detachAttendee(sessionId: SessionId, userId: string): Promise<void> {
    await prisma.sessionAttendee.deleteMany({
      where: { sessionId: sessionId.toString(), userId },
    });
  }

  async listAttendeeUserIds(sessionId: SessionId): Promise<string[]> {
    const records = await prisma.sessionAttendee.findMany({
      where: { sessionId: sessionId.toString() },
      orderBy: { createdAt: "asc" },
    });

    return records.map((record) => record.userId);
  }
}
