import { Event, EventId } from "@storyforge/domain";
import type { Event as PrismaEvent } from "@storyforge/database";

export class EventMapper {
  static toDomain(record: PrismaEvent): Event {
    return Event.rehydrate({
      id: EventId.fromString(record.id),
      campaignId: record.campaignId,
      sessionId: record.sessionId,
      title: record.title,
      description: record.description,
      occurredAt: record.occurredAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }

  static toPersistence(event: Event) {
    return {
      id: event.Id.toString(),
      campaignId: event.CampaignId,
      sessionId: event.SessionId,
      title: event.Title,
      description: event.Description,
      occurredAt: event.OccurredAt,
      createdAt: event.CreatedAt,
      updatedAt: event.UpdatedAt,
    };
  }
}
