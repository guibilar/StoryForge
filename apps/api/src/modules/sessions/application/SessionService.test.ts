import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CampaignMember,
  CampaignMemberRepository,
  NotFoundError,
  Session,
  SessionRepository,
  UserId,
  ValidationError,
} from "@storyforge/domain";
import { SessionService } from "./SessionService";

function makeRepository(): SessionRepository {
  return {
    findById: vi.fn(),
    findByCampaign: vi.fn(),
    findMaxSessionNumber: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    attachAttendee: vi.fn(),
    detachAttendee: vi.fn(),
    listAttendeeUserIds: vi.fn(),
  };
}

function makeCampaignMemberRepository(): CampaignMemberRepository {
  return {
    listByCampaign: vi.fn(),
    findByCampaignAndUser: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    transferOwnership: vi.fn(),
  };
}

const createDto = {
  campaignId: "campaign-1",
  date: new Date("2024-01-01T00:00:00Z"),
};

describe("SessionService", () => {
  let repository: SessionRepository;
  let campaignMemberRepository: CampaignMemberRepository;
  let service: SessionService;

  beforeEach(() => {
    repository = makeRepository();
    campaignMemberRepository = makeCampaignMemberRepository();
    service = new SessionService(repository, campaignMemberRepository);
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

  describe("attachAttendee", () => {
    it("throws NotFoundError when the session does not exist", async () => {
      vi.mocked(repository.findById).mockResolvedValue(null);

      await expect(service.attachAttendee("missing", "user-1")).rejects.toThrow(
        NotFoundError,
      );
    });

    it("rejects a userId that is not a member of the session's campaign", async () => {
      vi.mocked(repository.findMaxSessionNumber).mockResolvedValue(0);
      const session = await service.createSession(createDto);
      vi.mocked(repository.findById).mockResolvedValue(session);
      vi.mocked(
        campaignMemberRepository.findByCampaignAndUser,
      ).mockResolvedValue(null);

      await expect(
        service.attachAttendee(session.Id.toString(), "user-1"),
      ).rejects.toThrow(ValidationError);
      expect(repository.attachAttendee).not.toHaveBeenCalled();
    });

    it("attaches the attendee when the user is a campaign member", async () => {
      vi.mocked(repository.findMaxSessionNumber).mockResolvedValue(0);
      const session = await service.createSession(createDto);
      vi.mocked(repository.findById).mockResolvedValue(session);
      const membership = CampaignMember.create({
        campaignId: "campaign-1",
        userId: UserId.fromString("user-1"),
        role: "PLAYER",
      });
      vi.mocked(
        campaignMemberRepository.findByCampaignAndUser,
      ).mockResolvedValue(membership);

      await service.attachAttendee(session.Id.toString(), "user-1");

      expect(repository.attachAttendee).toHaveBeenCalledWith(
        session.Id,
        "user-1",
      );
    });
  });

  describe("detachAttendee", () => {
    it("throws NotFoundError when the session does not exist", async () => {
      vi.mocked(repository.findById).mockResolvedValue(null);

      await expect(service.detachAttendee("missing", "user-1")).rejects.toThrow(
        NotFoundError,
      );
    });

    it("delegates to the repository", async () => {
      vi.mocked(repository.findMaxSessionNumber).mockResolvedValue(0);
      const session = await service.createSession(createDto);
      vi.mocked(repository.findById).mockResolvedValue(session);

      await service.detachAttendee(session.Id.toString(), "user-1");

      expect(repository.detachAttendee).toHaveBeenCalledWith(
        session.Id,
        "user-1",
      );
    });
  });

  describe("listAttendeeUserIds", () => {
    it("delegates to the repository", async () => {
      vi.mocked(repository.listAttendeeUserIds).mockResolvedValue(["user-1"]);

      vi.mocked(repository.findMaxSessionNumber).mockResolvedValue(0);
      const session = await service.createSession(createDto);

      await expect(
        service.listAttendeeUserIds(session.Id.toString()),
      ).resolves.toEqual(["user-1"]);
    });
  });
});
