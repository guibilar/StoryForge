import { describe, expect, it, vi } from "vitest";
import {
  CampaignMember,
  Note,
  NoteVisibility,
  User,
  UserId,
} from "@storyforge/domain";
import { Mutation } from "./Mutation";
import type { GraphQLContext } from "../../../../graphql/context";
import type { NoteService } from "../../application/NoteService";
import type { CampaignMemberService } from "../../../campaignMembers/application/CampaignMemberService";

function makeNoteService(): NoteService {
  return {
    createNote: vi.fn(),
    updateNote: vi.fn(),
    deleteNote: vi.fn(),
    getNote: vi.fn(),
    listNotes: vi.fn(),
  } as unknown as NoteService;
}

function makeCampaignMemberService(): CampaignMemberService {
  return { getMembership: vi.fn() } as unknown as CampaignMemberService;
}

function makeContext(
  noteService: NoteService,
  campaignMemberService: CampaignMemberService,
  currentUser: User | null,
): GraphQLContext {
  return { noteService, campaignMemberService, currentUser } as GraphQLContext;
}

const loggedOutUser = null;
const authenticatedUser = User.create({
  email: "user@example.com",
  password: "hashed",
});

const membership = CampaignMember.create({
  campaignId: "campaign-1",
  userId: authenticatedUser.Id,
  role: "STORYTELLER",
});

const playerMembership = CampaignMember.create({
  campaignId: "campaign-1",
  userId: authenticatedUser.Id,
  role: "PLAYER",
});

describe("notes Mutation.createNote", () => {
  it("rejects with UNAUTHENTICATED when logged out", async () => {
    const noteService = makeNoteService();
    const campaignMemberService = makeCampaignMemberService();
    const context = makeContext(
      noteService,
      campaignMemberService,
      loggedOutUser,
    );
    const input = { campaignId: "campaign-1", title: "Session 1 prep" };

    await expect(
      Mutation.createNote(undefined, { input }, context),
    ).rejects.toMatchObject({
      extensions: { code: "UNAUTHENTICATED" },
    });
    expect(noteService.createNote).not.toHaveBeenCalled();
  });

  it("rejects with FORBIDDEN when not a campaign member", async () => {
    const noteService = makeNoteService();
    const campaignMemberService = makeCampaignMemberService();
    vi.mocked(campaignMemberService.getMembership).mockResolvedValue(null);
    const context = makeContext(
      noteService,
      campaignMemberService,
      authenticatedUser,
    );
    const input = { campaignId: "campaign-1", title: "Session 1 prep" };

    await expect(
      Mutation.createNote(undefined, { input }, context),
    ).rejects.toMatchObject({
      extensions: { code: "FORBIDDEN" },
    });
    expect(noteService.createNote).not.toHaveBeenCalled();
  });

  it("allows a Player to create a note (KAN-90)", async () => {
    const noteService = makeNoteService();
    const campaignMemberService = makeCampaignMemberService();
    vi.mocked(campaignMemberService.getMembership).mockResolvedValue(
      playerMembership,
    );
    const note = Note.create({
      campaignId: "campaign-1",
      authorId: authenticatedUser.Id,
      title: "My journal",
    });
    vi.mocked(noteService.createNote).mockResolvedValue(note);
    const context = makeContext(
      noteService,
      campaignMemberService,
      authenticatedUser,
    );
    const input = {
      campaignId: "campaign-1",
      title: "My journal",
      visibility: NoteVisibility.PRIVATE,
    };

    const result = await Mutation.createNote(undefined, { input }, context);

    expect(noteService.createNote).toHaveBeenCalledWith({
      ...input,
      authorId: authenticatedUser.Id.toString(),
    });
    expect(result).toBe(note);
  });

  it("rejects with FORBIDDEN when a Player creates a TARGETED note", async () => {
    const noteService = makeNoteService();
    const campaignMemberService = makeCampaignMemberService();
    vi.mocked(campaignMemberService.getMembership).mockResolvedValue(
      playerMembership,
    );
    const context = makeContext(
      noteService,
      campaignMemberService,
      authenticatedUser,
    );
    const input = {
      campaignId: "campaign-1",
      title: "Secret",
      visibility: NoteVisibility.TARGETED,
      recipientIds: [UserId.create().toString()],
    };

    await expect(
      Mutation.createNote(undefined, { input }, context),
    ).rejects.toMatchObject({
      extensions: { code: "FORBIDDEN" },
    });
    expect(noteService.createNote).not.toHaveBeenCalled();
  });

  it("rejects with FORBIDDEN when the campaign member is an Observer", async () => {
    const noteService = makeNoteService();
    const campaignMemberService = makeCampaignMemberService();
    vi.mocked(campaignMemberService.getMembership).mockResolvedValue(
      CampaignMember.create({
        campaignId: "campaign-1",
        userId: authenticatedUser.Id,
        role: "OBSERVER",
      }),
    );
    const context = makeContext(
      noteService,
      campaignMemberService,
      authenticatedUser,
    );
    const input = { campaignId: "campaign-1", title: "Session 1 prep" };

    await expect(
      Mutation.createNote(undefined, { input }, context),
    ).rejects.toMatchObject({
      extensions: { code: "FORBIDDEN" },
    });
    expect(noteService.createNote).not.toHaveBeenCalled();
  });

  it("rejects with FORBIDDEN when a Player files a note under a parent they cannot view", async () => {
    const noteService = makeNoteService();
    const campaignMemberService = makeCampaignMemberService();
    vi.mocked(campaignMemberService.getMembership).mockResolvedValue(
      playerMembership,
    );
    const hiddenParent = Note.create({
      campaignId: "campaign-1",
      authorId: UserId.create(),
      title: "GM secrets",
      visibility: NoteVisibility.PRIVATE,
    });
    vi.mocked(noteService.getNote).mockResolvedValue(hiddenParent);
    const context = makeContext(
      noteService,
      campaignMemberService,
      authenticatedUser,
    );
    const input = {
      campaignId: "campaign-1",
      title: "Sneaky child",
      parentNoteId: hiddenParent.Id.toString(),
    };

    await expect(
      Mutation.createNote(undefined, { input }, context),
    ).rejects.toMatchObject({
      extensions: { code: "FORBIDDEN" },
    });
    expect(noteService.createNote).not.toHaveBeenCalled();
  });

  it("delegates to noteService, injecting the member's userId as author", async () => {
    const noteService = makeNoteService();
    const campaignMemberService = makeCampaignMemberService();
    vi.mocked(campaignMemberService.getMembership).mockResolvedValue(
      membership,
    );
    const note = Note.create({
      campaignId: "campaign-1",
      authorId: UserId.create(),
      title: "Session 1 prep",
    });
    vi.mocked(noteService.createNote).mockResolvedValue(note);
    const context = makeContext(
      noteService,
      campaignMemberService,
      authenticatedUser,
    );
    const input = { campaignId: "campaign-1", title: "Session 1 prep" };

    const result = await Mutation.createNote(undefined, { input }, context);

    expect(noteService.createNote).toHaveBeenCalledWith({
      ...input,
      authorId: authenticatedUser.Id.toString(),
    });
    expect(result).toBe(note);
  });
});

describe("notes Mutation.updateNote", () => {
  it("rejects with UNAUTHENTICATED when logged out", async () => {
    const noteService = makeNoteService();
    const campaignMemberService = makeCampaignMemberService();
    const context = makeContext(
      noteService,
      campaignMemberService,
      loggedOutUser,
    );
    const input = { id: "note-1", title: "Renamed" };

    await expect(
      Mutation.updateNote(undefined, { input }, context),
    ).rejects.toMatchObject({
      extensions: { code: "UNAUTHENTICATED" },
    });
    expect(noteService.getNote).not.toHaveBeenCalled();
    expect(noteService.updateNote).not.toHaveBeenCalled();
  });

  it("rejects with FORBIDDEN when not a member of the note's campaign", async () => {
    const noteService = makeNoteService();
    const campaignMemberService = makeCampaignMemberService();
    const note = Note.create({
      campaignId: "campaign-1",
      authorId: UserId.create(),
      title: "Session 1 prep",
    });
    vi.mocked(noteService.getNote).mockResolvedValue(note);
    vi.mocked(campaignMemberService.getMembership).mockResolvedValue(null);
    const context = makeContext(
      noteService,
      campaignMemberService,
      authenticatedUser,
    );
    const input = { id: note.Id.toString(), title: "Renamed" };

    await expect(
      Mutation.updateNote(undefined, { input }, context),
    ).rejects.toMatchObject({
      extensions: { code: "FORBIDDEN" },
    });
    expect(noteService.updateNote).not.toHaveBeenCalled();
  });

  it("rejects with FORBIDDEN when a Player edits a note they did not author", async () => {
    const noteService = makeNoteService();
    const campaignMemberService = makeCampaignMemberService();
    const existing = Note.create({
      campaignId: "campaign-1",
      authorId: UserId.create(),
      title: "Session 1 prep",
    });
    vi.mocked(noteService.getNote).mockResolvedValue(existing);
    vi.mocked(campaignMemberService.getMembership).mockResolvedValue(
      playerMembership,
    );
    const context = makeContext(
      noteService,
      campaignMemberService,
      authenticatedUser,
    );
    const input = { id: existing.Id.toString(), title: "Renamed" };

    await expect(
      Mutation.updateNote(undefined, { input }, context),
    ).rejects.toMatchObject({
      extensions: { code: "FORBIDDEN" },
    });
    expect(noteService.updateNote).not.toHaveBeenCalled();
  });

  it("allows a Player to update their own note (KAN-90)", async () => {
    const noteService = makeNoteService();
    const campaignMemberService = makeCampaignMemberService();
    const own = Note.create({
      campaignId: "campaign-1",
      authorId: authenticatedUser.Id,
      title: "My journal",
    });
    vi.mocked(noteService.getNote).mockResolvedValue(own);
    vi.mocked(campaignMemberService.getMembership).mockResolvedValue(
      playerMembership,
    );
    vi.mocked(noteService.updateNote).mockResolvedValue(own);
    const context = makeContext(
      noteService,
      campaignMemberService,
      authenticatedUser,
    );
    const input = { id: own.Id.toString(), title: "Renamed journal" };

    const result = await Mutation.updateNote(undefined, { input }, context);

    expect(noteService.updateNote).toHaveBeenCalledWith(input);
    expect(result).toBe(own);
  });

  it("rejects with FORBIDDEN when a Player retargets recipients on their own note", async () => {
    const noteService = makeNoteService();
    const campaignMemberService = makeCampaignMemberService();
    const own = Note.create({
      campaignId: "campaign-1",
      authorId: authenticatedUser.Id,
      title: "My journal",
    });
    vi.mocked(noteService.getNote).mockResolvedValue(own);
    vi.mocked(campaignMemberService.getMembership).mockResolvedValue(
      playerMembership,
    );
    const context = makeContext(
      noteService,
      campaignMemberService,
      authenticatedUser,
    );
    const input = {
      id: own.Id.toString(),
      visibility: NoteVisibility.TARGETED,
      recipientIds: [UserId.create().toString()],
    };

    await expect(
      Mutation.updateNote(undefined, { input }, context),
    ).rejects.toMatchObject({
      extensions: { code: "FORBIDDEN" },
    });
    expect(noteService.updateNote).not.toHaveBeenCalled();
  });

  it("delegates to noteService when the user is a campaign member", async () => {
    const noteService = makeNoteService();
    const campaignMemberService = makeCampaignMemberService();
    const existing = Note.create({
      campaignId: "campaign-1",
      authorId: UserId.create(),
      title: "Session 1 prep",
    });
    const updated = Note.create({
      campaignId: "campaign-1",
      authorId: UserId.create(),
      title: "Renamed",
    });
    vi.mocked(noteService.getNote).mockResolvedValue(existing);
    vi.mocked(campaignMemberService.getMembership).mockResolvedValue(
      membership,
    );
    vi.mocked(noteService.updateNote).mockResolvedValue(updated);
    const context = makeContext(
      noteService,
      campaignMemberService,
      authenticatedUser,
    );
    const input = { id: existing.Id.toString(), title: "Renamed" };

    const result = await Mutation.updateNote(undefined, { input }, context);

    expect(noteService.updateNote).toHaveBeenCalledWith(input);
    expect(result).toBe(updated);
  });
});

describe("notes Mutation.deleteNote", () => {
  it("rejects with UNAUTHENTICATED when logged out", async () => {
    const noteService = makeNoteService();
    const campaignMemberService = makeCampaignMemberService();
    const context = makeContext(
      noteService,
      campaignMemberService,
      loggedOutUser,
    );

    await expect(
      Mutation.deleteNote(undefined, { id: "note-1" }, context),
    ).rejects.toMatchObject({
      extensions: { code: "UNAUTHENTICATED" },
    });
    expect(noteService.deleteNote).not.toHaveBeenCalled();
  });

  it("rejects with FORBIDDEN when not a member of the note's campaign", async () => {
    const noteService = makeNoteService();
    const campaignMemberService = makeCampaignMemberService();
    const note = Note.create({
      campaignId: "campaign-1",
      authorId: UserId.create(),
      title: "Session 1 prep",
    });
    vi.mocked(noteService.getNote).mockResolvedValue(note);
    vi.mocked(campaignMemberService.getMembership).mockResolvedValue(null);
    const context = makeContext(
      noteService,
      campaignMemberService,
      authenticatedUser,
    );

    await expect(
      Mutation.deleteNote(undefined, { id: note.Id.toString() }, context),
    ).rejects.toMatchObject({
      extensions: { code: "FORBIDDEN" },
    });
    expect(noteService.deleteNote).not.toHaveBeenCalled();
  });

  it("rejects with FORBIDDEN when a Player deletes a note they did not author", async () => {
    const noteService = makeNoteService();
    const campaignMemberService = makeCampaignMemberService();
    const note = Note.create({
      campaignId: "campaign-1",
      authorId: UserId.create(),
      title: "Session 1 prep",
    });
    vi.mocked(noteService.getNote).mockResolvedValue(note);
    vi.mocked(campaignMemberService.getMembership).mockResolvedValue(
      playerMembership,
    );
    const context = makeContext(
      noteService,
      campaignMemberService,
      authenticatedUser,
    );

    await expect(
      Mutation.deleteNote(undefined, { id: note.Id.toString() }, context),
    ).rejects.toMatchObject({
      extensions: { code: "FORBIDDEN" },
    });
    expect(noteService.deleteNote).not.toHaveBeenCalled();
  });

  it("allows a Player to delete their own note (KAN-90)", async () => {
    const noteService = makeNoteService();
    const campaignMemberService = makeCampaignMemberService();
    const own = Note.create({
      campaignId: "campaign-1",
      authorId: authenticatedUser.Id,
      title: "My journal",
    });
    vi.mocked(noteService.getNote).mockResolvedValue(own);
    vi.mocked(campaignMemberService.getMembership).mockResolvedValue(
      playerMembership,
    );
    vi.mocked(noteService.deleteNote).mockResolvedValue(undefined);
    const context = makeContext(
      noteService,
      campaignMemberService,
      authenticatedUser,
    );

    const result = await Mutation.deleteNote(
      undefined,
      { id: own.Id.toString() },
      context,
    );

    expect(noteService.deleteNote).toHaveBeenCalledWith(own.Id.toString());
    expect(result).toBe(true);
  });

  it("delegates to noteService and returns true when the user is a campaign member", async () => {
    const noteService = makeNoteService();
    const campaignMemberService = makeCampaignMemberService();
    const note = Note.create({
      campaignId: "campaign-1",
      authorId: UserId.create(),
      title: "Session 1 prep",
    });
    vi.mocked(noteService.getNote).mockResolvedValue(note);
    vi.mocked(campaignMemberService.getMembership).mockResolvedValue(
      membership,
    );
    vi.mocked(noteService.deleteNote).mockResolvedValue(undefined);
    const context = makeContext(
      noteService,
      campaignMemberService,
      authenticatedUser,
    );

    const result = await Mutation.deleteNote(
      undefined,
      { id: note.Id.toString() },
      context,
    );

    expect(noteService.deleteNote).toHaveBeenCalledWith(note.Id.toString());
    expect(result).toBe(true);
  });
});
