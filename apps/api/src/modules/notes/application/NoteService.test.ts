import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CampaignMember,
  CampaignMemberRepository,
  Entity,
  EntityRepository,
  EntityVisibility,
  Note,
  NoteId,
  NoteLink,
  NoteLinkRepository,
  NoteRepository,
  NoteVisibility,
  NotFoundError,
  UserId,
} from "@storyforge/domain";
import { NoteService } from "./NoteService";

function makeRepository(): NoteRepository {
  return {
    findById: vi.fn(),
    findByCampaign: vi.fn(),
    findByTitle: vi.fn().mockResolvedValue([]),
    findChildren: vi.fn().mockResolvedValue([]),
    findRoots: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    update: vi.fn(),
    createWithLinks: vi.fn(),
    updateWithLinks: vi.fn(),
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
    deleteByNote: vi.fn(),
    deleteByTargetEntity: vi.fn(),
  };
}

function makeCampaignMemberRepository(): CampaignMemberRepository {
  return {
    listByCampaign: vi.fn().mockResolvedValue([]),
    findByCampaignAndUser: vi.fn().mockResolvedValue(null),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    transferOwnership: vi.fn(),
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
  let campaignMemberRepository: CampaignMemberRepository;
  let service: NoteService;

  beforeEach(() => {
    repository = makeRepository();
    entityRepository = makeEntityRepository();
    noteLinkRepository = makeNoteLinkRepository();
    campaignMemberRepository = makeCampaignMemberRepository();
    service = new NoteService(
      repository,
      entityRepository,
      noteLinkRepository,
      campaignMemberRepository,
    );
  });

  describe("createNote", () => {
    it("creates the note and persists it", async () => {
      const note = await service.createNote(createDto);

      expect(note.Title).toBe("Session 1 prep");
      expect(note.Content).toBe("Some markdown content.");
      expect(note.AuthorId.toString()).toBe(createDto.authorId);
      expect(repository.createWithLinks).toHaveBeenCalledWith(note, []);
    });

    it("defaults content to an empty string when omitted", async () => {
      const note = await service.createNote({
        campaignId: "campaign-1",
        authorId: UserId.create().toString(),
        title: "Blank note",
      });

      expect(note.Content).toBe("");
    });

    it("defaults visibility to SHARED", async () => {
      const note = await service.createNote(createDto);

      expect(note.Visibility).toBe(NoteVisibility.SHARED);
      expect(note.RecipientIds).toEqual([]);
    });

    it("creates a TARGETED note when the recipients are campaign members", async () => {
      const recipient = UserId.create();
      vi.mocked(
        campaignMemberRepository.findByCampaignAndUser,
      ).mockResolvedValue(
        CampaignMember.create({
          campaignId: createDto.campaignId,
          userId: recipient,
          role: "PLAYER",
        }),
      );

      const note = await service.createNote({
        ...createDto,
        visibility: NoteVisibility.TARGETED,
        recipientIds: [recipient.toString()],
      });

      expect(note.Visibility).toBe(NoteVisibility.TARGETED);
      expect(note.RecipientIds.map((id) => id.toString())).toEqual([
        recipient.toString(),
      ]);
      expect(
        campaignMemberRepository.findByCampaignAndUser,
      ).toHaveBeenCalledWith(createDto.campaignId, expect.anything());
    });

    it("rejects recipients who are not campaign members", async () => {
      await expect(
        service.createNote({
          ...createDto,
          visibility: NoteVisibility.TARGETED,
          recipientIds: [UserId.create().toString()],
        }),
      ).rejects.toThrow("All note recipients must be members of the campaign.");
      expect(repository.createWithLinks).not.toHaveBeenCalled();
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
      expect(repository.updateWithLinks).toHaveBeenCalledWith(note, []);
    });

    it("changes visibility to PRIVATE and clears stale recipients", async () => {
      const recipient = UserId.create();
      const note = Note.create({
        campaignId: createDto.campaignId,
        authorId: UserId.fromString(createDto.authorId),
        title: createDto.title,
        visibility: NoteVisibility.TARGETED,
        recipientIds: [recipient],
      });
      vi.mocked(repository.findById).mockResolvedValue(note);

      const updated = await service.updateNote({
        id: note.Id.toString(),
        visibility: NoteVisibility.PRIVATE,
      });

      expect(updated.Visibility).toBe(NoteVisibility.PRIVATE);
      expect(updated.RecipientIds).toEqual([]);
    });

    it("keeps existing recipients when visibility stays TARGETED and no recipients are sent", async () => {
      const recipient = UserId.create();
      const note = Note.create({
        campaignId: createDto.campaignId,
        authorId: UserId.fromString(createDto.authorId),
        title: createDto.title,
        visibility: NoteVisibility.TARGETED,
        recipientIds: [recipient],
      });
      vi.mocked(repository.findById).mockResolvedValue(note);

      const updated = await service.updateNote({
        id: note.Id.toString(),
        visibility: NoteVisibility.TARGETED,
      });

      expect(updated.RecipientIds.map((id) => id.toString())).toEqual([
        recipient.toString(),
      ]);
    });

    it("replaces recipients after validating campaign membership", async () => {
      const oldRecipient = UserId.create();
      const newRecipient = UserId.create();
      const note = Note.create({
        campaignId: createDto.campaignId,
        authorId: UserId.fromString(createDto.authorId),
        title: createDto.title,
        visibility: NoteVisibility.TARGETED,
        recipientIds: [oldRecipient],
      });
      vi.mocked(repository.findById).mockResolvedValue(note);
      vi.mocked(
        campaignMemberRepository.findByCampaignAndUser,
      ).mockResolvedValue(
        CampaignMember.create({
          campaignId: createDto.campaignId,
          userId: newRecipient,
          role: "PLAYER",
        }),
      );

      const updated = await service.updateNote({
        id: note.Id.toString(),
        recipientIds: [newRecipient.toString()],
      });

      expect(updated.RecipientIds.map((id) => id.toString())).toEqual([
        newRecipient.toString(),
      ]);
    });

    it("rejects a recipient update naming a non-member", async () => {
      const note = Note.create({
        campaignId: createDto.campaignId,
        authorId: UserId.fromString(createDto.authorId),
        title: createDto.title,
        visibility: NoteVisibility.TARGETED,
        recipientIds: [UserId.create()],
      });
      vi.mocked(repository.findById).mockResolvedValue(note);

      await expect(
        service.updateNote({
          id: note.Id.toString(),
          recipientIds: [UserId.create().toString()],
        }),
      ).rejects.toThrow("All note recipients must be members of the campaign.");
      expect(repository.updateWithLinks).not.toHaveBeenCalled();
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
      expect(noteLinkRepository.deleteByNote).toHaveBeenCalledWith(
        note.Id.toString(),
      );
    });

    it("cascades the soft-delete down the whole subtree", async () => {
      const authorId = UserId.fromString(createDto.authorId);
      const root = Note.create({
        campaignId: createDto.campaignId,
        authorId,
        title: "Root",
      });
      const child = Note.create({
        campaignId: createDto.campaignId,
        authorId,
        title: "Child",
        parentNoteId: root.Id,
      });
      const grandchild = Note.create({
        campaignId: createDto.campaignId,
        authorId,
        title: "Grandchild",
        parentNoteId: child.Id,
      });

      vi.mocked(repository.findById).mockImplementation(async (id) => {
        if (id.equals(root.Id)) return root;
        if (id.equals(child.Id)) return child;
        if (id.equals(grandchild.Id)) return grandchild;
        return null;
      });
      vi.mocked(repository.findChildren).mockImplementation(async (noteId) => {
        if (noteId === root.Id.toString()) return [child];
        if (noteId === child.Id.toString()) return [grandchild];
        return [];
      });

      await service.deleteNote(root.Id.toString());

      expect(root.isDeleted()).toBe(true);
      expect(child.isDeleted()).toBe(true);
      expect(grandchild.isDeleted()).toBe(true);
      expect(repository.update).toHaveBeenCalledTimes(3);
      expect(noteLinkRepository.deleteByNote).toHaveBeenCalledWith(
        root.Id.toString(),
      );
      expect(noteLinkRepository.deleteByNote).toHaveBeenCalledWith(
        child.Id.toString(),
      );
      expect(noteLinkRepository.deleteByNote).toHaveBeenCalledWith(
        grandchild.Id.toString(),
      );
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
      expect(repository.createWithLinks).toHaveBeenCalledWith(note, [
        expect.objectContaining({ TargetEntityId: entity.Id.toString() }),
      ]);
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

      expect(repository.createWithLinks).toHaveBeenCalledWith(note, [
        expect.objectContaining({ TargetNoteId: targetNote.Id.toString() }),
      ]);
    });

    it("drops unresolvable links instead of persisting them", async () => {
      const note = await service.createNote({
        ...createDto,
        content: "Refers to [[Nobody Known]].",
      });

      expect(repository.createWithLinks).toHaveBeenCalledWith(note, []);
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

      expect(repository.createWithLinks).toHaveBeenCalledWith(note, [
        expect.objectContaining({ TargetEntityId: entity.Id.toString() }),
      ]);
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

      expect(repository.updateWithLinks).toHaveBeenCalledWith(existing, [
        expect.objectContaining({ TargetEntityId: entity.Id.toString() }),
      ]);
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

  describe("nesting", () => {
    it("creates a note under a parent in the same campaign", async () => {
      const parent = Note.create({
        campaignId: createDto.campaignId,
        authorId: UserId.fromString(createDto.authorId),
        title: "Session 12",
      });
      vi.mocked(repository.findById).mockResolvedValue(parent);

      const child = await service.createNote({
        ...createDto,
        title: "Scene 1",
        parentNoteId: parent.Id.toString(),
      });

      expect(child.ParentNoteId?.equals(parent.Id)).toBe(true);
    });

    it("throws NotFoundError when the parent does not exist", async () => {
      vi.mocked(repository.findById).mockResolvedValue(null);

      await expect(
        service.createNote({ ...createDto, parentNoteId: "missing" }),
      ).rejects.toThrow(NotFoundError);
    });

    it("rejects a parent from a different campaign", async () => {
      const parent = Note.create({
        campaignId: "other-campaign",
        authorId: UserId.fromString(createDto.authorId),
        title: "Session 12",
      });
      vi.mocked(repository.findById).mockResolvedValue(parent);

      await expect(
        service.createNote({
          ...createDto,
          parentNoteId: parent.Id.toString(),
        }),
      ).rejects.toThrow("Parent note must be in the same campaign.");
    });

    it("moves a note under a new parent", async () => {
      const note = Note.create({
        campaignId: createDto.campaignId,
        authorId: UserId.fromString(createDto.authorId),
        title: "Scene 1",
      });
      const parent = Note.create({
        campaignId: createDto.campaignId,
        authorId: UserId.fromString(createDto.authorId),
        title: "Session 12",
      });
      vi.mocked(repository.findById).mockImplementation(async (id) => {
        if (id.equals(note.Id)) return note;
        if (id.equals(parent.Id)) return parent;
        return null;
      });

      const moved = await service.moveNote(
        note.Id.toString(),
        parent.Id.toString(),
      );

      expect(moved.ParentNoteId?.equals(parent.Id)).toBe(true);
      expect(repository.update).toHaveBeenCalledWith(note);
    });

    it("detaches a note to root when moved to a null parent", async () => {
      const parentId = NoteId.create();
      const note = Note.create({
        campaignId: createDto.campaignId,
        authorId: UserId.fromString(createDto.authorId),
        title: "Scene 1",
        parentNoteId: parentId,
      });
      vi.mocked(repository.findById).mockResolvedValue(note);

      const moved = await service.moveNote(note.Id.toString(), null);

      expect(moved.ParentNoteId).toBeNull();
    });

    it("rejects moving a note under itself or its own descendant (cycle)", async () => {
      const grandparent = Note.create({
        campaignId: createDto.campaignId,
        authorId: UserId.fromString(createDto.authorId),
        title: "Grandparent",
      });
      const parent = Note.create({
        campaignId: createDto.campaignId,
        authorId: UserId.fromString(createDto.authorId),
        title: "Parent",
        parentNoteId: grandparent.Id,
      });
      const child = Note.create({
        campaignId: createDto.campaignId,
        authorId: UserId.fromString(createDto.authorId),
        title: "Child",
        parentNoteId: parent.Id,
      });
      vi.mocked(repository.findById).mockImplementation(async (id) => {
        if (id.equals(grandparent.Id)) return grandparent;
        if (id.equals(parent.Id)) return parent;
        if (id.equals(child.Id)) return child;
        return null;
      });

      // Moving "grandparent" under its own descendant "child" would create a cycle.
      await expect(
        service.moveNote(grandparent.Id.toString(), child.Id.toString()),
      ).rejects.toThrow("Moving this note would create a cycle.");
    });

    it("rejects nesting deeper than the max depth", async () => {
      const authorId = UserId.fromString(createDto.authorId);
      let current = Note.create({
        campaignId: createDto.campaignId,
        authorId,
        title: "Level 1",
      });
      const notesById = new Map([[current.Id.toString(), current]]);

      for (let level = 2; level <= 5; level++) {
        current = Note.create({
          campaignId: createDto.campaignId,
          authorId,
          title: `Level ${level}`,
          parentNoteId: current.Id,
        });
        notesById.set(current.Id.toString(), current);
      }

      const deepestParent = current;
      const newNote = Note.create({
        campaignId: createDto.campaignId,
        authorId,
        title: "Too deep",
      });
      notesById.set(newNote.Id.toString(), newNote);

      vi.mocked(repository.findById).mockImplementation(
        async (id) => notesById.get(id.toString()) ?? null,
      );

      await expect(
        service.moveNote(newNote.Id.toString(), deepestParent.Id.toString()),
      ).rejects.toThrow("Notes cannot be nested more than 5 levels deep.");
    });
  });
});
