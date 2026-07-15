import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  Note,
  NoteRepository,
  NotFoundError,
  UserId,
} from "@storyforge/domain";
import { NoteService } from "./NoteService";

function makeRepository(): NoteRepository {
  return {
    findById: vi.fn(),
    findByCampaign: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  };
}

const createDto = {
  campaignId: "campaign-1",
  authorId: UserId.create().toString(),
  title: "Session 1 prep",
  content: "Some markdown content.",
};

describe("NoteService", () => {
  let repository: NoteRepository;
  let service: NoteService;

  beforeEach(() => {
    repository = makeRepository();
    service = new NoteService(repository);
  });

  describe("createNote", () => {
    it("creates the note and persists it", async () => {
      const note = await service.createNote(createDto);

      expect(note.Title).toBe("Session 1 prep");
      expect(note.Content).toBe("Some markdown content.");
      expect(note.AuthorId.toString()).toBe(createDto.authorId);
      expect(repository.create).toHaveBeenCalledWith(note);
    });

    it("defaults content to an empty string when omitted", async () => {
      const note = await service.createNote({
        campaignId: "campaign-1",
        authorId: UserId.create().toString(),
        title: "Blank note",
      });

      expect(note.Content).toBe("");
    });
  });

  describe("updateNote", () => {
    it("throws NotFoundError when the note does not exist", async () => {
      vi.mocked(repository.findById).mockResolvedValue(null);

      await expect(service.updateNote({ id: "missing" })).rejects.toThrow(
        NotFoundError,
      );
    });

    it("updates title and content", async () => {
      const note = Note.create({
        campaignId: createDto.campaignId,
        authorId: UserId.fromString(createDto.authorId),
        title: createDto.title,
      });
      vi.mocked(repository.findById).mockResolvedValue(note);

      const updated = await service.updateNote({
        id: note.Id.toString(),
        title: "Renamed",
        content: "Updated content",
      });

      expect(updated.Title).toBe("Renamed");
      expect(updated.Content).toBe("Updated content");
      expect(repository.update).toHaveBeenCalledWith(note);
    });
  });

  describe("deleteNote", () => {
    it("throws NotFoundError when the note does not exist", async () => {
      vi.mocked(repository.findById).mockResolvedValue(null);

      await expect(service.deleteNote("missing")).rejects.toThrow(
        NotFoundError,
      );
    });

    it("soft-deletes and persists the note", async () => {
      const note = Note.create({
        campaignId: createDto.campaignId,
        authorId: UserId.fromString(createDto.authorId),
        title: createDto.title,
      });
      vi.mocked(repository.findById).mockResolvedValue(note);

      await service.deleteNote(note.Id.toString());

      expect(note.isDeleted()).toBe(true);
      expect(repository.update).toHaveBeenCalledWith(note);
    });
  });

  describe("getNote", () => {
    it("throws NotFoundError when the note does not exist", async () => {
      vi.mocked(repository.findById).mockResolvedValue(null);

      await expect(service.getNote("missing")).rejects.toThrow(NotFoundError);
    });

    it("returns the note when found", async () => {
      const note = Note.create({
        campaignId: createDto.campaignId,
        authorId: UserId.fromString(createDto.authorId),
        title: createDto.title,
      });
      vi.mocked(repository.findById).mockResolvedValue(note);

      await expect(service.getNote(note.Id.toString())).resolves.toBe(note);
    });
  });

  describe("listNotes", () => {
    it("delegates to the repository", async () => {
      const notes = [
        Note.create({
          campaignId: createDto.campaignId,
          authorId: UserId.fromString(createDto.authorId),
          title: createDto.title,
        }),
      ];
      vi.mocked(repository.findByCampaign).mockResolvedValue(notes);

      await expect(service.listNotes("campaign-1")).resolves.toBe(notes);
      expect(repository.findByCampaign).toHaveBeenCalledWith("campaign-1");
    });
  });
});
