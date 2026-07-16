import { describe, expect, it } from "vitest";
import { Attachment } from "./Attachment";
import { AttachmentId } from "./AttachmentId";

const validProps = {
  noteId: "note-1",
  url: "/uploads/note-1/a.png",
  fileName: "portrait.png",
  mimeType: "image/png",
  sizeBytes: 1024,
};

describe("Attachment", () => {
  it("creates an attachment with the given props", () => {
    const attachment = Attachment.create(validProps);

    expect(attachment.NoteId).toBe(validProps.noteId);
    expect(attachment.Url).toBe(validProps.url);
    expect(attachment.FileName).toBe(validProps.fileName);
    expect(attachment.MimeType).toBe(validProps.mimeType);
    expect(attachment.SizeBytes).toBe(validProps.sizeBytes);
    expect(attachment.CreatedAt).toBeInstanceOf(Date);
  });

  it("rehydrates preserving id and createdAt", () => {
    const id = AttachmentId.create();
    const createdAt = new Date("2024-01-01T00:00:00Z");

    const attachment = Attachment.rehydrate({
      id,
      noteId: validProps.noteId,
      url: validProps.url,
      fileName: validProps.fileName,
      mimeType: validProps.mimeType,
      sizeBytes: validProps.sizeBytes,
      createdAt,
    });

    expect(attachment.Id.equals(id)).toBe(true);
    expect(attachment.CreatedAt).toBe(createdAt);
  });

  it("rejects a file name longer than 255 characters", () => {
    expect(() =>
      Attachment.create({ ...validProps, fileName: `${"a".repeat(256)}.png` }),
    ).toThrow("Attachment file name cannot exceed 255 characters.");
  });

  it.each(["", "   "])("rejects an empty file name %j", (fileName) => {
    expect(() => Attachment.create({ ...validProps, fileName })).toThrow(
      "Attachment file name cannot be empty.",
    );
  });

  it.each(["application/pdf", "text/plain", "image/svg+xml"])(
    "rejects a disallowed mime type %j",
    (mimeType) => {
      expect(() => Attachment.create({ ...validProps, mimeType })).toThrow(
        "Invalid file type. Only JPEG, PNG, GIF, and WEBP are allowed.",
      );
    },
  );
});
