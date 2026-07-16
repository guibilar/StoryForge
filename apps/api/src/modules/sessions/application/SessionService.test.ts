import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotFoundError, Session, SessionRepository } from "@storyforge/domain";
import { SessionService } from "./SessionService";

function makeRepository(): SessionRepository {
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
  date: new Date("2024-01-01T00:00:00Z"),
};

describe("SessionService", () => {
  let repository: SessionRepository;
  let service: SessionService;

  beforeEach(() => {
    repository = makeRepository();
    service = new SessionService(repository);
  });

  describe("createSession", () => {
    it("assigns sessionNumber 1 for the first session in a campaign", async () => {
      vi.mocked(repository.findMaxSessionNumber).mockResolvedValue(0);

      const session = await service.createSession(createDto);

      expect(session.SessionNumber).toBe(1);
      expect(repository.create).toHaveBeenCalledWith(session);
    });

    it("increments sessionNumber based on the current max", async () => {
      vi.mocked(repository.findMaxSessionNumber).mockResolvedValue(4);

      const session = await service.createSession(createDto);

      expect(session.SessionNumber).toBe(5);
    });
  });

  describe("updateSession", () => {
    it("throws NotFoundError when the session does not exist", async () => {
      vi.mocked(repository.findById).mockResolvedValue(null);

      await expect(service.updateSession({ id: "missing" })).rejects.toThrow(
        NotFoundError,
      );
    });

    it("changes date and summary", async () => {
      vi.mocked(repository.findMaxSessionNumber).mockResolvedValue(0);
      const session = await service.createSession(createDto);
      vi.mocked(repository.findById).mockResolvedValue(session);

      const newDate = new Date("2024-03-01T00:00:00Z");
      const updated = await service.updateSession({
        id: session.Id.toString(),
        date: newDate,
        summary: "Updated summary",
      });

      expect(updated.Date).toBe(newDate);
      expect(updated.Summary).toBe("Updated summary");
      expect(repository.update).toHaveBeenCalledWith(session);
    });
  });

  describe("deleteSession", () => {
    it("throws NotFoundError when the session does not exist", async () => {
      vi.mocked(repository.findById).mockResolvedValue(null);

      await expect(service.deleteSession("missing")).rejects.toThrow(
        NotFoundError,
      );
      expect(repository.delete).not.toHaveBeenCalled();
    });

    it("deletes the session", async () => {
      vi.mocked(repository.findMaxSessionNumber).mockResolvedValue(0);
      const session = await service.createSession(createDto);
      vi.mocked(repository.findById).mockResolvedValue(session);

      await service.deleteSession(session.Id.toString());

      expect(repository.delete).toHaveBeenCalledWith(session.Id);
    });
  });

  describe("getSession", () => {
    it("throws NotFoundError when the session does not exist", async () => {
      vi.mocked(repository.findById).mockResolvedValue(null);

      await expect(service.getSession("missing")).rejects.toThrow(
        NotFoundError,
      );
    });

    it("returns the session when found", async () => {
      vi.mocked(repository.findMaxSessionNumber).mockResolvedValue(0);
      const session = await service.createSession(createDto);
      vi.mocked(repository.findById).mockResolvedValue(session);

      await expect(service.getSession(session.Id.toString())).resolves.toBe(
        session,
      );
    });
  });

  describe("findSession", () => {
    it("returns null when the session does not exist", async () => {
      vi.mocked(repository.findById).mockResolvedValue(null);

      await expect(service.findSession("missing")).resolves.toBeNull();
    });

    it("returns the session when found", async () => {
      vi.mocked(repository.findMaxSessionNumber).mockResolvedValue(0);
      const session = await service.createSession(createDto);
      vi.mocked(repository.findById).mockResolvedValue(session);

      await expect(service.findSession(session.Id.toString())).resolves.toBe(
        session,
      );
    });
  });

  describe("listSessions", () => {
    it("delegates to the repository", async () => {
      vi.mocked(repository.findMaxSessionNumber).mockResolvedValue(0);
      const sessions: Session[] = [await service.createSession(createDto)];
      vi.mocked(repository.findByCampaign).mockResolvedValue(sessions);

      await expect(service.listSessions("campaign-1")).resolves.toBe(sessions);
      expect(repository.findByCampaign).toHaveBeenCalledWith("campaign-1");
    });
  });
});
