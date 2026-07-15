import type { Attachment as DomainAttachment } from "@storyforge/domain";

export const Attachment = {
  id: (attachment: DomainAttachment) => attachment.Id.toString(),
  noteId: (attachment: DomainAttachment) => attachment.NoteId,
  url: (attachment: DomainAttachment) => attachment.Url,
  fileName: (attachment: DomainAttachment) => attachment.FileName,
  mimeType: (attachment: DomainAttachment) => attachment.MimeType,
  sizeBytes: (attachment: DomainAttachment) => attachment.SizeBytes,
  createdAt: (attachment: DomainAttachment) =>
    attachment.CreatedAt.toISOString(),
};
