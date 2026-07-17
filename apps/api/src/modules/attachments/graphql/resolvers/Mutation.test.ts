import { describe, expect, it, vi } from "vitest";
import { Attachment, CampaignMember, Note, User } from "@storyforge/domain";
import { Mutation } from "./Mutation";
import type { GraphQLContext } from "../../../../graphql/context";
import type { AttachmentService } from "../../application/AttachmentService";
import type { NoteService } from "../../../notes/application/NoteService";
import type { LocalImageStore } from "../../../entities/infrastructure/LocalImageStore";
import type { CampaignMemberService } from "../../../campaignMembers/application/CampaignMemberService";

function makeAttachmentService(): AttachmentService {
  return {
    createAttachment: vi.fn(),
    getAttachment: vi.fn(),
    listByNote: vi.fn(),
    deleteAttachment: vi.fn(),
  } as unknown as AttachmentService;
}

function makeNoteService(): NoteService {
  return {
    createNote: vi.fn(),
    updateNote: vi.fn(),
    deleteNote: vi.fn(),
    getNote: vi.fn(),
    listNotes: vi.fn(),
  } as unknown as NoteService;
}

function makeImageStorage(): LocalImageStore {
  return { save: vi.fn() } as unknown as LocalImageStore;
}

function makeCampaignMemberService(): CampaignMemberService {
  return { getMembership: vi.fn() } as unknown as CampaignMemberService;
}

function makeContext(
  attachmentService: AttachmentService,
  noteService: NoteService,
  imageStorage: LocalImageStore,
  campaignMemberService: CampaignMemberService,
  currentUser: User | null,
): GraphQLContext {
  return {
    attachmentService,
    noteService,
    imageStorage,
    campaignMemberService,
    currentUser,
  } as GraphQLContext;
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

const note = Note.create({
  campaignId: "campaign-1",
  authorId: authenticatedUser.Id,
  title: "Session 1 prep",
});

const file = {
  name: "portrait.png",
  type: "image/png",
  size: 8,
  arrayBuffer: async () => new ArrayBuffer(8),
} as File;

describe("attachments Mutation.uploadNoteAttachment", () => {
  it("rejects with UNAUTHENTICATED when logged out", async () => {
    const attachmentService = makeAttachmentService();
    const noteService = makeNoteService();
    const imageStorage = makeImageStorage();
    const campaignMemberService = makeCampaignMemberService();
    const context = makeContext(
      attachmentService,
      noteService,
      imageStorage,
      campaignMemberService,
      loggedOutUser,
    );

    await expect(
      Mutation.uploadNoteAttachment(
        undefined,
        { noteId: "note-1", file },
        context,
      ),
    ).rejects.toMatchObject({
      extensions: { code: "UNAUTHENTICATED" },
    });
    expect(imageStorage.save).not.toHaveBeenCalled();
    expect(attachmentService.createAttachment).not.toHaveBeenCalled();
  });

  it("rejects with FORBIDDEN when not a member of the note's campaign", async () => {
    const attachmentService = makeAttachmentService();
    const noteService = makeNoteService();
    const imageStorage = makeImageStorage();
    const campaignMemberService = makeCampaignMemberService();
    vi.mocked(noteService.getNote).mockResolvedValue(note);
    vi.mocked(campaignMemberService.getMembership).mockResolvedValue(null);
    const context = makeContext(
      attachmentService,
      noteService,
      imageStorage,
      campaignMemberService,
      authenticatedUser,
    );

    await expect(
      Mutation.uploadNoteAttachment(
        undefined,
        { noteId: "note-1", file },
        context,
      ),
    ).rejects.toMatchObject({ extensions: { code: "FORBIDDEN" } });
    expect(imageStorage.save).not.toHaveBeenCalled();
    expect(attachmentService.createAttachment).not.toHaveBeenCalled();
  });

  it("saves the file and creates the attachment when the user is a campaign member", async () => {
    const attachmentService = makeAttachmentService();
    const noteService = makeNoteService();
    const imageStorage = makeImageStorage();
    const campaignMemberService = makeCampaignMemberService();
    vi.mocked(noteService.getNote).mockResolvedValue(note);
    vi.mocked(campaignMemberService.getMembership).mockResolvedValue(
      membership,
    );
    vi.mocked(imageStorage.save).mockResolvedValue("/uploads/note-1/a.png");
    const created = Attachment.create({
      noteId: "note-1",
      url: "/uploads/note-1/a.png",
      fileName: "portrait.png",
      mimeType: "image/png",
      sizeBytes: 8,
    });
    vi.mocked(attachmentService.createAttachment).mockResolvedValue(created);
    const context = makeContext(
      attachmentService,
      noteService,
      imageStorage,
      campaignMemberService,
      authenticatedUser,
    );

    const result = await Mutation.uploadNoteAttachment(
      undefined,
      { noteId: "note-1", file },
      context,
    );

    expect(imageStorage.save).toHaveBeenCalledWith("note-1", file);
    expect(attachmentService.createAttachment).toHaveBeenCalledWith({
      noteId: "note-1",
      url: "/uploads/note-1/a.png",
      fileName: "portrait.png",
      mimeType: "image/png",
      sizeBytes: 8,
    });
    expect(result).toBe(created);
  });
});

describe("attachments Mutation.deleteAttachment", () => {
  const attachment = Attachment.create({
    noteId: "note-1",
    url: "/uploads/note-1/a.png",
    fileName: "portrait.png",
    mimeType: "image/png",
    sizeBytes: 8,
  });

  it("rejects with UNAUTHENTICATED when logged out", async () => {
    const attachmentService = makeAttachmentService();
    const noteService = makeNoteService();
    const imageStorage = makeImageStorage();
    const campaignMemberService = makeCampaignMemberService();
    const context = makeContext(
      attachmentService,
      noteService,
      imageStorage,
      campaignMemberService,
      loggedOutUser,
    );

    await expect(
      Mutation.deleteAttachment(undefined, { id: "attachment-1" }, context),
    ).rejects.toMatchObject({
      extensions: { code: "UNAUTHENTICATED" },
    });
    expect(attachmentService.deleteAttachment).not.toHaveBeenCalled();
  });

  it("rejects with NOT_FOUND (not FORBIDDEN) when not a member of the attachment's note campaign, to avoid leaking existence across campaigns", async () => {
    const attachmentService = makeAttachmentService();
    const noteService = makeNoteService();
    const imageStorage = makeImageStorage();
    const campaignMemberService = makeCampaignMemberService();
    vi.mocked(attachmentService.getAttachment).mockResolvedValue(attachment);
    vi.mocked(noteService.getNote).mockResolvedValue(note);
    vi.mocked(campaignMemberService.getMembership).mockResolvedValue(null);
    const context = makeContext(
      attachmentService,
      noteService,
      imageStorage,
      campaignMemberService,
      authenticatedUser,
    );

    await expect(
      Mutation.deleteAttachment(undefined, { id: "attachment-1" }, context),
    ).rejects.toMatchObject({ extensions: { code: "NOT_FOUND" } });
    expect(attachmentService.deleteAttachment).not.toHaveBeenCalled();
  });

  it("deletes the attachment and returns true when the user is a campaign member", async () => {
    const attachmentService = makeAttachmentService();
    const noteService = makeNoteService();
    const imageStorage = makeImageStorage();
    const campaignMemberService = makeCampaignMemberService();
    vi.mocked(attachmentService.getAttachment).mockResolvedValue(attachment);
    vi.mocked(noteService.getNote).mockResolvedValue(note);
    vi.mocked(campaignMemberService.getMembership).mockResolvedValue(
      membership,
    );
    vi.mocked(attachmentService.deleteAttachment).mockResolvedValue(undefined);
    const context = makeContext(
      attachmentService,
      noteService,
      imageStorage,
      campaignMemberService,
      authenticatedUser,
    );

    const result = await Mutation.deleteAttachment(
      undefined,
      { id: "attachment-1" },
      context,
    );

    expect(attachmentService.deleteAttachment).toHaveBeenCalledWith(
      "attachment-1",
    );
    expect(result).toBe(true);
  });
});
