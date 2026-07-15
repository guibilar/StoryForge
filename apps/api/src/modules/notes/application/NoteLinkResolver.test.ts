import { describe, expect, it, vi } from "vitest";
import {
  Entity,
  EntityRepository,
  EntityVisibility,
  Note,
  NoteRepository,
  UserId,
} from "@storyforge/domain";
import { NoteLinkResolver } from "./NoteLinkResolver";

function makeEntityRepository(): EntityRepository {
  return {
    findById: vi.fn().mockResolvedValue(null),
    findByCampaign: vi.fn(),
    existsByName: vi.fn(),
    findByName: vi.fn().mockResolvedValue(null),
    create: vi.fn(),
    update: vi.fn(),
  };
}

function makeNoteRepository(): NoteRepository {
  return {
    findById: vi.fn().mockResolvedValue(null),
    findByCampaign: vi.fn(),
    findByTitle: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    update: vi.fn(),
  };
}

const campaignId = "campaign-1";

describe("NoteLinkResolver", () => {
  it("resolves a plain label to an Entity by name", async () => {
    const entityRepository = makeEntityRepository();
    const noteRepository = makeNoteRepository();
    const entity = Entity.create({
      campaignId,
      type: "npc",
      name: "Gruk the Orc",
      visibility: EntityVisibility.PUBLIC,
    });
    vi.mocked(entityRepository.findByName).mockResolvedValue(entity);

    const resolver = new NoteLinkResolver(entityRepository, noteRepository);
    const resolved = await resolver.resolve(campaignId, [
      { label: "Gruk the Orc" },
    ]);

    expect(resolved).toEqual([{ targetEntityId: entity.Id.toString() }]);
  });

  it("falls back to a Note title when no Entity matches", async () => {
    const entityRepository = makeEntityRepository();
    const noteRepository = makeNoteRepository();
    const note = Note.create({
      campaignId,
      authorId: UserId.create(),
      title: "Session 0",
    });
    vi.mocked(noteRepository.findByTitle).mockResolvedValue([note]);

    const resolver = new NoteLinkResolver(entityRepository, noteRepository);
    const resolved = await resolver.resolve(campaignId, [
      { label: "Session 0" },
    ]);

    expect(resolved).toEqual([{ targetNoteId: note.Id.toString() }]);
  });

  it("drops a label matching more than one Note title", async () => {
    const entityRepository = makeEntityRepository();
    const noteRepository = makeNoteRepository();
    const noteA = Note.create({
      campaignId,
      authorId: UserId.create(),
      title: "Session 0",
    });
    const noteB = Note.create({
      campaignId,
      authorId: UserId.create(),
      title: "Session 0",
    });
    vi.mocked(noteRepository.findByTitle).mockResolvedValue([noteA, noteB]);

    const resolver = new NoteLinkResolver(entityRepository, noteRepository);
    const resolved = await resolver.resolve(campaignId, [
      { label: "Session 0" },
    ]);

    expect(resolved).toEqual([]);
  });

  it("drops an unresolvable label", async () => {
    const entityRepository = makeEntityRepository();
    const noteRepository = makeNoteRepository();

    const resolver = new NoteLinkResolver(entityRepository, noteRepository);
    const resolved = await resolver.resolve(campaignId, [
      { label: "Nobody Known" },
    ]);

    expect(resolved).toEqual([]);
  });

  it("resolves an explicit entity id only within the same campaign", async () => {
    const entityRepository = makeEntityRepository();
    const noteRepository = makeNoteRepository();
    const entity = Entity.create({
      campaignId: "other-campaign",
      type: "npc",
      name: "Gruk the Orc",
      visibility: EntityVisibility.PUBLIC,
    });
    vi.mocked(entityRepository.findById).mockResolvedValue(entity);

    const resolver = new NoteLinkResolver(entityRepository, noteRepository);
    const resolved = await resolver.resolve(campaignId, [
      {
        label: "Gruk",
        explicitTargetType: "entity",
        explicitTargetId: entity.Id.toString(),
      },
    ]);

    expect(resolved).toEqual([]);
  });

  it("deduplicates links that resolve to the same target", async () => {
    const entityRepository = makeEntityRepository();
    const noteRepository = makeNoteRepository();
    const entity = Entity.create({
      campaignId,
      type: "npc",
      name: "Gruk the Orc",
      visibility: EntityVisibility.PUBLIC,
    });
    vi.mocked(entityRepository.findByName).mockResolvedValue(entity);

    const resolver = new NoteLinkResolver(entityRepository, noteRepository);
    const resolved = await resolver.resolve(campaignId, [
      { label: "Gruk the Orc" },
      { label: "Gruk the Orc" },
    ]);

    expect(resolved).toEqual([{ targetEntityId: entity.Id.toString() }]);
  });
});
