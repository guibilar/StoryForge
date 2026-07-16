import {
  Entity,
  EntityId,
  EntityRepository,
  Event,
  EventId,
  EventRepository,
  NotFoundError,
  SessionId,
  SessionRepository,
  ValidationError,
} from "@storyforge/domain";

export interface CreateEventDto {
  campaignId: string;
  sessionId?: string | null;
  title: string;
  description?: string | null;
  occurredAt: Date;
}

export interface UpdateEventDto {
  id: string;
  sessionId?: string | null;
  title?: string;
  description?: string | null;
  occurredAt?: Date;
}

export class EventService {
  constructor(
    private readonly repository: EventRepository,
    private readonly entityRepository: EntityRepository,
    private readonly sessionRepository: SessionRepository,
  ) {}

  async createEvent(dto: CreateEventDto): Promise<Event> {
    if (dto.sessionId) {
      await this.validateSession(dto.campaignId, dto.sessionId);
    }

    const event = Event.create(dto);

    await this.repository.create(event);

    return event;
  }

  async updateEvent(dto: UpdateEventDto): Promise<Event> {
    const event = await this.getEventOrThrow(dto.id);

    if (dto.sessionId !== undefined && dto.sessionId !== null) {
      await this.validateSession(event.CampaignId, dto.sessionId);
    }

    if (dto.title !== undefined) {
      event.changeTitle(dto.title);
    }

    if (dto.description !== undefined) {
      event.changeDescription(dto.description);
    }

    if (dto.occurredAt !== undefined) {
      event.changeOccurredAt(dto.occurredAt);
    }

    if (dto.sessionId !== undefined) {
      event.changeSession(dto.sessionId);
    }

    await this.repository.update(event);

    return event;
  }

  async deleteEvent(id: string): Promise<void> {
    const event = await this.getEventOrThrow(id);

    await this.repository.delete(event.Id);
  }

  async getEvent(id: string): Promise<Event> {
    return this.getEventOrThrow(id);
  }

  async listEvents(campaignId: string): Promise<Event[]> {
    return this.repository.findByCampaign(campaignId);
  }

  async listEventsBySession(sessionId: string): Promise<Event[]> {
    return this.repository.findBySession(sessionId);
  }

  async attachParticipant(
    eventId: string,
    entityId: string,
    role?: string | null,
  ): Promise<Event> {
    const event = await this.getEventOrThrow(eventId);

    const entity = await this.entityRepository.findById(
      EntityId.fromString(entityId),
    );

    if (!entity) {
      throw new NotFoundError("Entity not found.");
    }

    if (entity.CampaignId !== event.CampaignId) {
      throw new ValidationError("Entity does not belong to this campaign.");
    }

    await this.repository.attachParticipant(event.Id, entityId, role);

    return event;
  }

  async detachParticipant(eventId: string, entityId: string): Promise<Event> {
    const event = await this.getEventOrThrow(eventId);

    await this.repository.detachParticipant(event.Id, entityId);

    return event;
  }

  async listParticipants(eventId: string): Promise<Entity[]> {
    return this.repository.findParticipants(EventId.fromString(eventId));
  }

  private async getEventOrThrow(id: string): Promise<Event> {
    const event = await this.repository.findById(EventId.fromString(id));

    if (!event) {
      throw new NotFoundError("Event not found.");
    }

    return event;
  }

  private async validateSession(
    campaignId: string,
    sessionId: string,
  ): Promise<void> {
    const session = await this.sessionRepository.findById(
      SessionId.fromString(sessionId),
    );

    if (!session) {
      throw new NotFoundError("Session not found.");
    }

    if (session.CampaignId !== campaignId) {
      throw new ValidationError("Session does not belong to this campaign.");
    }
  }
}
