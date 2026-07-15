import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  Entity,
  EntityRepository,
  EntityVisibility,
  Note,
  NoteLink,
  NoteLinkRepository,
  NoteRepository,
  NotFoundError,
  UserId,
} from "@storyforge/domain";
import { NoteService } from "./NoteService";

function makeRepository(): NoteRepository {
  return {
    findById: vi.fn(),
    findByCampaign: vi.fn(),
    findByTitle: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    update: vi.fn(),
  };
}

function makeEntityRepository(): EntityRepository {
  return {
    findById: vi.fn(),
    findByCampaign: vi.fn(),
    existsByName: vi.fn(),
    findByName: vi.fn().mockResolvedValue(null),
    create: vi.fn(),
    update: vi.fn(),
  };
}

function makeNoteLinkRepository(): NoteLinkRepository {
  return {
    findByNote: vi.fn().mockResolvedValue([]),
    findByTargetEntity: vi.fn().mockResolvedValue([]),
    findByTargetNote: vi.fn().mockResolvedValue([]),
    replaceForNote: vi.fn(),
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
  let entityRepository: EntityRepository;
  let noteLinkRepository: NoteLinkRepository;
  let service: NoteService;

  beforeEach(() => {
    repository = makeRepository();
    entityRepository = makeEntityRepository();
    noteLinkRepository = makeNoteLinkRepository();
    service = new NoteService(repository, entityRepository, noteLinkRepository);
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

  describe("link syncing", () => {
    it("resolves [[Label]] links against an Entity by name and persists them", async () => {
      const entity = Entity.create({
        campaignId: createDto.campaignId,
        type: "npc",
        name: "Gruk the Orc",
        visibility: EntityVisibility.PUBLIC,
      });
      vi.mocked(entityRepository.findByName).mockResolvedValue(entity);

      const note = await service.createNote({
        ...createDto,
        content: "Met [[Gruk the Orc]] at the tavern.",
      });

      expect(entityRepository.findByName).toHaveBeenCalledWith(
        createDto.campaignId,
        "Gruk the Orc",
      );
      expect(noteLinkRepository.replaceForNote).toHaveBeenCalledWith(
        note.Id.toString(),
        [expect.objectContaining({ TargetEntityId: entity.Id.toString() })],
      );
    });

    it("falls back to a Note title match when no Entity matches", async () => {
      const targetNote = Note.create({
        campaignId: createDto.campaignId,
        authorId: UserId.fromString(createDto.authorId),
        title: "Session 0",
      });
      vi.mocked(repository.findByTitle).mockResolvedValue([targetNote]);

      const note = await service.createNote({
        ...createDto,
        content: "See [[Session 0]] recap.",
      });

      expect(noteLinkRepository.replaceForNote).toHaveBeenCalledWith(
        note.Id.toString(),
        [expect.objectContaining({ TargetNoteId: targetNote.Id.toString() })],
      );
    });

    it("drops unresolvable links instead of persisting them", async () => {
      const note = await service.createNote({
        ...createDto,
        content: "Refers to [[Nobody Known]].",
      });

      expect(noteLinkRepository.replaceForNote).toHaveBeenCalledWith(
        note.Id.toString(),
        [],
      );
    });

    it("resolves explicit [[Label|entity:<id>]] links within the same campaign only", async () => {
      const entity = Entity.create({
        campaignId: createDto.campaignId,
        type: "npc",
        name: "Gruk the Orc",
        visibility: EntityVisibility.PUBLIC,
      });
      vi.mocked(entityRepository.findById).mockResolvedValue(entity);

      const note = await service.createNote({
        ...createDto,
        content: `[[Gruk|entity:${entity.Id.toString()}]]`,
      });

      expect(noteLinkRepository.replaceForNote).toHaveBeenCalledWith(
        note.Id.toString(),
        [expect.objectContaining({ TargetEntityId: entity.Id.toString() })],
      );
    });

    it("re-syncs links on updateNote", async () => {
      const existing = Note.create({
        campaignId: createDto.campaignId,
        authorId: UserId.fromString(createDto.authorId),
        title: createDto.title,
      });
      vi.mocked(repository.findById).mockResolvedValue(existing);
      const entity = Entity.create({
        campaignId: createDto.campaignId,
        type: "npc",
        name: "Gruk the Orc",
        visibility: EntityVisibility.PUBLIC,
      });
      vi.mocked(entityRepository.findByName).mockResolvedValue(entity);

      await service.updateNote({
        id: existing.Id.toString(),
        content: "Now mentions [[Gruk the Orc]].",
      });

      expect(noteLinkRepository.replaceForNote).toHaveBeenCalledWith(
        existing.Id.toString(),
        [expect.objectContaining({ TargetEntityId: entity.Id.toString() })],
      );
    });
  });

  describe("listLinkedEntities", () => {
    it("hydrates NoteLink targets into Entities", async () => {
      const entity = Entity.create({
        campaignId: createDto.campaignId,
        type: "npc",
        name: "Gruk the Orc",
        visibility: EntityVisibility.PUBLIC,
      });
      const link = NoteLink.create({
        noteId: "note-1",
        targetEntityId: entity.Id.toString(),
      });
      vi.mocked(noteLinkRepository.findByNote).mockResolvedValue([link]);
      vi.mocked(entityRepository.findById).mockResolvedValue(entity);

      await expect(service.listLinkedEntities("note-1")).resolves.toEqual([
        entity,
      ]);
    });
  });

  describe("listEntityBacklinks", () => {
    it("hydrates NoteLink sources into Notes", async () => {
      const sourceNote = Note.create({
        campaignId: createDto.campaignId,
        authorId: UserId.fromString(createDto.authorId),
        title: createDto.title,
      });
      const link = NoteLink.create({
        noteId: sourceNote.Id.toString(),
        targetEntityId: "entity-1",
      });
      vi.mocked(noteLinkRepository.findByTargetEntity).mockResolvedValue([
        link,
      ]);
      vi.mocked(repository.findById).mockResolvedValue(sourceNote);

      await expect(service.listEntityBacklinks("entity-1")).resolves.toEqual([
        sourceNote,
      ]);
    });
  });
});
