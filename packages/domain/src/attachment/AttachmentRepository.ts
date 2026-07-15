import { Attachment } from "./Attachment";
import { AttachmentId } from "./AttachmentId";

export interface AttachmentRepository {
  findById(id: AttachmentId): Promise<Attachment | null>;

  findByNote(noteId: string): Promise<Attachment[]>;

  create(attachment: Attachment): Promise<void>;

  delete(id: AttachmentId): Promise<void>;
}
