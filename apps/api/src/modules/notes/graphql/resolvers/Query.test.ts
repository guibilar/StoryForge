import { describe, expect, it, vi } from "vitest";
import {
  CampaignMember,
  Note,
  NoteVisibility,
  NotFoundError,
  User,
  UserId,
} from "@storyforge/domain";
import { Query } from "./Query";
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
  role: "PLAYER",
});

describe("notes Query.note", () => {
  it("rejects with UNAUTHENTICATED when logged out", async () => {
    const noteService = makeNoteService();
    const campaignMemberService = makeCampaignMemberService();
    const context = makeContext(
      noteService,
      campaignMemberService,
      loggedOutUser,
    );

    await expect(
      Query.note(undefined, { id: "note-1" }, context),
    ).rejects.toMatchObject({
      extensions: { code: "UNAUTHENTICATED" },
    });
    expect(noteService.getNote).not.toHaveBeenCalled();
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
      Query.note(undefined, { id: note.Id.toString() }, context),
    ).rejects.toMatchObject({ extensions: { code: "FORBIDDEN" } });
  });

  it("returns the note when the user is a campaign member", async () => {
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
    const context = makeContext(
      noteService,
      campaignMemberService,
      authenticatedUser,
    );

    const result = await Query.note(
      undefined,
      { id: note.Id.toString() },
      context,
    );

    expect(noteService.getNote).toHaveBeenCalledWith(note.Id.toString());
    expect(result).toBe(note);
  });

  it("rejects with FORBIDDEN when a player queries another author's PRIVATE note", async () => {
    const noteService = makeNoteService();
    const campaignMemberService = makeCampaignMemberService();
    const note = Note.create({
      campaignId: "campaign-1",
      authorId: UserId.create(),
      title: "GM secrets",
      visibility: NoteVisibility.PRIVATE,
    });
    vi.mocked(noteService.getNote).mockResolvedValue(note);
    vi.mocked(campaignMemberService.getMembership).mockResolvedValue(
      membership,
    );
    const context = makeContext(
      noteService,
      campaignMemberService,
      authenticatedUser,
    );

    await expect(
      Query.note(undefined, { id: note.Id.toString() }, context),
    ).rejects.toMatchObject({ extensions: { code: "FORBIDDEN" } });
  });

  it("returns a TARGETED note to a named recipient", async () => {
    const noteService = makeNoteService();
    const campaignMemberService = makeCampaignMemberService();
    const note = Note.create({
      campaignId: "campaign-1",
      authorId: UserId.create(),
      title: "Handout for you",
      visibility: NoteVisibility.TARGETED,
      recipientIds: [authenticatedUser.Id],
    });
    vi.mocked(noteService.getNote).mockResolvedValue(note);
    vi.mocked(campaignMemberService.getMembership).mockResolvedValue(
      membership,
    );
    const context = makeContext(
      noteService,
      campaignMemberService,
      authenticatedUser,
    );

    const result = await Query.note(
      undefined,
      { id: note.Id.toString() },
      context,
    );

    expect(result).toBe(note);
  });

  it("translates domain errors into GraphQL errors", async () => {
    const noteService = makeNoteService();
    const campaignMemberService = makeCampaignMemberService();
    vi.mocked(noteService.getNote).mockRejectedValue(
      new NotFoundError("Note not found"),
    );
    const context = makeContext(
      noteService,
      campaignMemberService,
      authenticatedUser,
    );

    await expect(
      Query.note(undefined, { id: "missing" }, context),
    ).rejects.toMatchObject({ extensions: { code: "NOT_FOUND" } });
  });
});

describe("notes Query.notes", () => {
  it("rejects with UNAUTHENTICATED when logged out", async () => {
    const noteService = makeNoteService();
    const campaignMemberService = makeCampaignMemberService();
    const context = makeContext(
      noteService,
      campaignMemberService,
      loggedOutUser,
    );

    await expect(
      Query.notes(undefined, { campaignId: "campaign-1" }, context),
    ).rejects.toMatchObject({
      extensions: { code: "UNAUTHENTICATED" },
    });
    expect(noteService.listNotes).not.toHaveBeenCalled();
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

    await expect(
      Query.notes(undefined, { campaignId: "campaign-1" }, context),
    ).rejects.toMatchObject({ extensions: { code: "FORBIDDEN" } });
    expect(noteService.listNotes).not.toHaveBeenCalled();
  });

  it("delegates to the service when the user is a campaign member", async () => {
    const noteService = makeNoteService();
    const campaignMemberService = makeCampaignMemberService();
    vi.mocked(campaignMemberService.getMembership).mockResolvedValue(
      membership,
    );
    const notes = [
      Note.create({
        campaignId: "campaign-1",
        authorId: UserId.create(),
        title: "Session 1 prep",
      }),
    ];
    vi.mocked(noteService.listNotes).mockResolvedValue(notes);
    const context = makeContext(
      noteService,
      campaignMemberService,
      authenticatedUser,
    );

    const result = await Query.notes(
      undefined,
      { campaignId: "campaign-1" },
      context,
    );

    expect(noteService.listNotes).toHaveBeenCalledWith("campaign-1");
    expect(result).toEqual(notes);
  });

  it("filters out notes a player cannot view", async () => {
    const noteService = makeNoteService();
    const campaignMemberService = makeCampaignMemberService();
    vi.mocked(campaignMemberService.getMembership).mockResolvedValue(
      membership,
    );
    const shared = Note.create({
      campaignId: "campaign-1",
      authorId: UserId.create(),
      title: "Party log",
    });
    const privateNote = Note.create({
      campaignId: "campaign-1",
      authorId: UserId.create(),
      title: "GM secrets",
      visibility: NoteVisibility.PRIVATE,
    });
    const handout = Note.create({
      campaignId: "campaign-1",
      authorId: UserId.create(),
      title: "Handout for you",
      visibility: NoteVisibility.TARGETED,
      recipientIds: [authenticatedUser.Id],
    });
    const otherHandout = Note.create({
      campaignId: "campaign-1",
      authorId: UserId.create(),
      title: "Handout for someone else",
      visibility: NoteVisibility.TARGETED,
      recipientIds: [UserId.create()],
    });
    vi.mocked(noteService.listNotes).mockResolvedValue([
      shared,
      privateNote,
      handout,
      otherHandout,
    ]);
    const context = makeContext(
      noteService,
      campaignMemberService,
      authenticatedUser,
    );

    const result = await Query.notes(
      undefined,
      { campaignId: "campaign-1" },
      context,
    );

    expect(result).toEqual([shared, handout]);
  });
});
