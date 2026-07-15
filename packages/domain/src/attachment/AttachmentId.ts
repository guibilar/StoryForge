import { Id } from "../shared/Id";

export type AttachmentId = Id<"Attachment">;

export const AttachmentId = {
  create: (): AttachmentId => Id.create<"Attachment">(),
  fromString: (value: string): AttachmentId =>
    Id.fromString<"Attachment">(value),
};
