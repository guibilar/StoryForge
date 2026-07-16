import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  Entity,
  EntityRepository,
  EntityVisibility,
  Event,
  EventRepository,
  NotFoundError,
  Session,
  SessionRepository,
  ValidationError,
} from "@storyforge/domain";
import { EventService } from "./EventService";

function makeEventRepository(): EventRepository {
  return {
    findById: vi.fn(),
    findByCampaign: vi.fn(),
    findBySession: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    attachParticipant: vi.fn(),
    detachParticipant: vi.fn(),
    findParticipants: vi.fn(),
  };
}

function makeEntityRepository(): EntityRepository {
  return {
    findById: vi.fn(),
    findByCampaign: vi.fn(),
    existsByName: vi.fn(),
    findByName: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  };
}

function makeSessionRepository(): SessionRepository {
  return {
    findById: vi.fn(),
    findByCampaign: vi.fn(),
    findMaxSessionNumber: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
}

const createDto = {
  campaignId: "campaign-1",
  title: "Goblin ambush",
  occurredAt: new Date("2024-01-01T00:00:00Z"),
};

function makeSession(overrides?: Partial<{ campaignId: string }>): Session {
  return Session.create({
    campaignId: overrides?.campaignId ?? "campaign-1",
    sessionNumber: 1,
    date: new Date("2024-01-01T00:00:00Z"),
  });
}

function makeEntity(): Entity {
  return Entity.create({
    campaignId: "campaign-1",
    type: "npc",
    name: "Goblin",
    visibility: EntityVisibility.PUBLIC,
  });
}

describe("EventService", () => {
  let repository: EventRepository;
  let entityRepository: EntityRepository;
  let sessionRepository: SessionRepository;
  let service: EventService;

  beforeEach(() => {
    repository = makeEventRepository();
    entityRepository = makeEntityRepository();
    sessionRepository = makeSessionRepository();
    service = new EventService(repository, entityRepository, sessionRepository);
  });

  describe("createEvent", () => {
    it("creates the event when no sessionId is given", async () => {
      const event = await service.createEvent(createDto);

      expect(event.Title).toBe("Goblin ambush");
      expect(repository.create).toHaveBeenCalledWith(event);
      expect(sessionRepository.findById).not.toHaveBeenCalled();
    });

    it("validates the session exists and belongs to the same campaign", async () => {
      const session = makeSession();
      vi.mocked(sessionRepository.findById).mockResolvedValue(session);

      const event = await service.createEvent({
        ...createDto,
        sessionId: session.Id.toString(),
      });

      expect(event.SessionId).toBe(session.Id.toString());
      expect(repository.create).toHaveBeenCalledWith(event);
    });

    it("rejects a sessionId that does not exist", async () => {
      vi.mocked(sessionRepository.findById).mockResolvedValue(null);

      await expect(
        service.createEvent({ ...createDto, sessionId: "missing" }),
      ).rejects.toThrow(NotFoundError);
      expect(repository.create).not.toHaveBeenCalled();
    });

    it("rejects a sessionId belonging to a different campaign", async () => {
      const session = makeSession({ campaignId: "other-campaign" });
      vi.mocked(sessionRepository.findById).mockResolvedValue(session);

      await expect(
        service.createEvent({
          ...createDto,
          sessionId: session.Id.toString(),
        }),
      ).rejects.toThrow(ValidationError);
      expect(repository.create).not.toHaveBeenCalled();
    });
  });

  describe("updateEvent", () => {
    it("throws NotFoundError when the event does not exist", async () => {
      vi.mocked(repository.findById).mockResolvedValue(null);

      await expect(service.updateEvent({ id: "missing" })).rejects.toThrow(
        NotFoundError,
      );
    });

    it("updates title, description, occurredAt", async () => {
      const event = await service.createEvent(createDto);
      vi.mocked(repository.findById).mockResolvedValue(event);
      const newDate = new Date("2024-02-01T00:00:00Z");

      const updated = await service.updateEvent({
        id: event.Id.toString(),
        title: "Renamed",
        description: "New description",
        occurredAt: newDate,
      });

      expect(updated.Title).toBe("Renamed");
      expect(updated.Description).toBe("New description");
      expect(updated.OccurredAt).toBe(newDate);
      expect(repository.update).toHaveBeenCalledWith(event);
    });

    it("clears sessionId when explicitly set to null", async () => {
      const session = makeSession();
      vi.mocked(sessionRepository.findById).mockResolvedValue(session);
      const event = await service.createEvent({
        ...createDto,
        sessionId: session.Id.toString(),
      });
      vi.mocked(repository.findById).mockResolvedValue(event);

      const updated = await service.updateEvent({
        id: event.Id.toString(),
        sessionId: null,
      });

      expect(updated.SessionId).toBeNull();
    });

    it("rejects updating to a sessionId from a different campaign", async () => {
      const event = await service.createEvent(createDto);
      vi.mocked(repository.findById).mockResolvedValue(event);
      const otherSession = makeSession({ campaignId: "other-campaign" });
      vi.mocked(sessionRepository.findById).mockResolvedValue(otherSession);

      await expect(
        service.updateEvent({
          id: event.Id.toString(),
          sessionId: otherSession.Id.toString(),
        }),
      ).rejects.toThrow(ValidationError);
      expect(repository.update).not.toHaveBeenCalled();
    });
  });

  describe("deleteEvent", () => {
    it("throws NotFoundError when the event does not exist", async () => {
      vi.mocked(repository.findById).mockResolvedValue(null);

      await expect(service.deleteEvent("missing")).rejects.toThrow(
        NotFoundError,
      );
      expect(repository.delete).not.toHaveBeenCalled();
    });

    it("deletes the event", async () => {
      const event = await service.createEvent(createDto);
      vi.mocked(repository.findById).mockResolvedValue(event);

      await service.deleteEvent(event.Id.toString());

      expect(repository.delete).toHaveBeenCalledWith(event.Id);
    });
  });

  describe("getEvent", () => {
    it("throws NotFoundError when the event does not exist", async () => {
      vi.mocked(repository.findById).mockResolvedValue(null);

      await expect(service.getEvent("missing")).rejects.toThrow(NotFoundError);
    });

    it("returns the event when found", async () => {
      const event = await service.createEvent(createDto);
      vi.mocked(repository.findById).mockResolvedValue(event);

      await expect(service.getEvent(event.Id.toString())).resolves.toBe(event);
    });
  });

  describe("listEvents", () => {
    it("delegates to the repository", async () => {
      const events: Event[] = [await service.createEvent(createDto)];
      vi.mocked(repository.findByCampaign).mockResolvedValue(events);

      await expect(service.listEvents("campaign-1")).resolves.toBe(events);
      expect(repository.findByCampaign).toHaveBeenCalledWith("campaign-1");
    });
  });

  describe("listEventsBySession", () => {
    it("delegates to the repository", async () => {
      const events: Event[] = [await service.createEvent(createDto)];
      vi.mocked(repository.findBySession).mockResolvedValue(events);

      await expect(service.listEventsBySession("session-1")).resolves.toBe(
        events,
      );
      expect(repository.findBySession).toHaveBeenCalledWith("session-1");
    });
  });

  describe("attachParticipant", () => {
    it("throws NotFoundError when the event does not exist", async () => {
      vi.mocked(repository.findById).mockResolvedValue(null);

      await expect(
        service.attachParticipant("missing", "entity-1"),
      ).rejects.toThrow(NotFoundError);
      expect(repository.attachParticipant).not.toHaveBeenCalled();
    });

    it("throws NotFoundError when the entity does not exist", async () => {
      const event = await service.createEvent(createDto);
      vi.mocked(repository.findById).mockResolvedValue(event);
      vi.mocked(entityRepository.findById).mockResolvedValue(null);

      await expect(
        service.attachParticipant(event.Id.toString(), "missing-entity"),
      ).rejects.toThrow(NotFoundError);
      expect(repository.attachParticipant).not.toHaveBeenCalled();
    });

    it("attaches the participant and returns the event", async () => {
      const event = await service.createEvent(createDto);
      vi.mocked(repository.findById).mockResolvedValue(event);
      const entity = makeEntity();
      vi.mocked(entityRepository.findById).mockResolvedValue(entity);

      const result = await service.attachParticipant(
        event.Id.toString(),
        entity.Id.toString(),
        "witness",
      );

      expect(repository.attachParticipant).toHaveBeenCalledWith(
        event.Id,
        entity.Id.toString(),
        "witness",
      );
      expect(result).toBe(event);
    });
  });

  describe("detachParticipant", () => {
    it("throws NotFoundError when the event does not exist", async () => {
      vi.mocked(repository.findById).mockResolvedValue(null);

      await expect(
        service.detachParticipant("missing", "entity-1"),
      ).rejects.toThrow(NotFoundError);
      expect(repository.detachParticipant).not.toHaveBeenCalled();
    });

    it("detaches the participant and returns the event", async () => {
      const event = await service.createEvent(createDto);
      vi.mocked(repository.findById).mockResolvedValue(event);

      const result = await service.detachParticipant(
        event.Id.toString(),
        "entity-1",
      );

      expect(repository.detachParticipant).toHaveBeenCalledWith(
        event.Id,
        "entity-1",
      );
      expect(result).toBe(event);
    });
  });

  describe("listParticipants", () => {
    it("delegates to the repository", async () => {
      const event = await service.createEvent(createDto);
      const entities = [makeEntity()];
      vi.mocked(repository.findParticipants).mockResolvedValue(entities);

      await expect(service.listParticipants(event.Id.toString())).resolves.toBe(
        entities,
      );
      expect(repository.findParticipants).toHaveBeenCalledWith(event.Id);
    });
  });
});
