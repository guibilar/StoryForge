import { describe, expect, it, vi } from "vitest";
import {
  Attachment,
  AttachmentRepository,
  NotFoundError,
} from "@storyforge/domain";
import { AttachmentService, AttachmentFileStore } from "./AttachmentService";

function makeRepository(): AttachmentRepository {
  return {
    create: vi.fn(),
    findById: vi.fn(),
    findByNote: vi.fn(),
    delete: vi.fn(),
  } as unknown as AttachmentRepository;
}

function makeFileStore(): AttachmentFileStore {
  return { delete: vi.fn() } as unknown as AttachmentFileStore;
}

describe("AttachmentService.deleteAttachment", () => {
  it("deletes the DB row and unlinks the underlying file", async () => {
    const repository = makeRepository();
    const fileStore = makeFileStore();
    const attachment = Attachment.create({
      noteId: "note-1",
      url: "/uploads/note-1/a.png",
      fileName: "portrait.png",
      mimeType: "image/png",
      sizeBytes: 8,
    });
    vi.mocked(repository.findById).mockResolvedValue(attachment);
    const service = new AttachmentService(repository, fileStore);

    await service.deleteAttachment(attachment.Id.toString());

    expect(repository.delete).toHaveBeenCalledWith(attachment.Id);
    expect(fileStore.delete).toHaveBeenCalledWith("/uploads/note-1/a.png");
  });

  it("throws NotFoundError and never touches the file store when the attachment doesn't exist", async () => {
    const repository = makeRepository();
    const fileStore = makeFileStore();
    vi.mocked(repository.findById).mockResolvedValue(null);
    const service = new AttachmentService(repository, fileStore);

    await expect(
      service.deleteAttachment("00000000-0000-0000-0000-000000000000"),
    ).rejects.toThrow(NotFoundError);
    expect(fileStore.delete).not.toHaveBeenCalled();
  });
});
