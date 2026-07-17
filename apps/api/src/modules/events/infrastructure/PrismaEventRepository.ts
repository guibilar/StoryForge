import { Entity, Event, EventId, EventRepository } from "@storyforge/domain";

import { prisma } from "@storyforge/database";
import { EventMapper } from "./EventMapper";
import { EntityMapper } from "../../entities/infrastructure/EntityMapper";

export class PrismaEventRepository implements EventRepository {
  async findById(id: EventId): Promise<Event | null> {
    const record = await prisma.event.findUnique({
      where: {
        id: id.toString(),
      },
    });

    if (!record) {
      return null;
    }

    return EventMapper.toDomain(record);
  }

  async findByCampaign(campaignId: string): Promise<Event[]> {
    const records = await prisma.event.findMany({
      where: {
        campaignId,
      },
      orderBy: {
        occurredAt: "asc",
      },
    });

    return records.map(EventMapper.toDomain);
  }

  async findBySession(sessionId: string): Promise<Event[]> {
    const records = await prisma.event.findMany({
      where: {
        sessionId,
      },
      orderBy: {
        occurredAt: "asc",
      },
    });

    return records.map(EventMapper.toDomain);
  }

  async create(event: Event): Promise<void> {
    await prisma.event.create({
      data: EventMapper.toPersistence(event),
    });
  }

  async update(event: Event): Promise<void> {
    await prisma.event.update({
      where: {
        id: event.Id.toString(),
      },
      data: EventMapper.toPersistence(event),
    });
  }

  async delete(id: EventId): Promise<void> {
    await prisma.event.delete({
      where: {
        id: id.toString(),
      },
    });
  }

  async attachParticipant(
    eventId: EventId,
    entityId: string,
    role?: string | null,
  ): Promise<void> {
    await prisma.eventParticipant.upsert({
      where: {
        eventId_entityId: { eventId: eventId.toString(), entityId },
      },
      create: { eventId: eventId.toString(), entityId, role: role ?? null },
      update: { role: role ?? null },
    });
  }

  async detachParticipant(eventId: EventId, entityId: string): Promise<void> {
    await prisma.eventParticipant.deleteMany({
      where: { eventId: eventId.toString(), entityId },
    });
  }

  async findParticipants(eventId: EventId): Promise<Entity[]> {
    const records = await prisma.entity.findMany({
      where: {
        eventParticipations: {
          some: {
            eventId: eventId.toString(),
          },
        },
      },
      orderBy: {
        name: "asc",
      },
    });

    return records.map(EntityMapper.toDomain);
  }
}
