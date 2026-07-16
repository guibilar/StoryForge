import { Entity } from "../entity";
import { Event } from "./Event";
import { EventId } from "./EventId";

export interface EventRepository {
  findById(id: EventId): Promise<Event | null>;

  findByCampaign(campaignId: string): Promise<Event[]>;

  findBySession(sessionId: string): Promise<Event[]>;

  create(event: Event): Promise<void>;

  update(event: Event): Promise<void>;

  delete(id: EventId): Promise<void>;

  attachParticipant(
    eventId: EventId,
    entityId: string,
    role?: string | null,
  ): Promise<void>;

  detachParticipant(eventId: EventId, entityId: string): Promise<void>;

  findParticipants(eventId: EventId): Promise<Entity[]>;
}
