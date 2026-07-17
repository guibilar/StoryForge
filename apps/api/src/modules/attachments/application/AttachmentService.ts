import {
  Attachment,
  AttachmentId,
  AttachmentRepository,
  NotFoundError,
} from "@storyforge/domain";

export interface CreateAttachmentDto {
  noteId: string;
  url: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

export interface AttachmentFileStore {
  delete(url: string): Promise<void>;
}

export class AttachmentService {
  constructor(
    private readonly repository: AttachmentRepository,
    private readonly fileStore: AttachmentFileStore,
  ) {}

  async createAttachment(dto: CreateAttachmentDto): Promise<Attachment> {
    const attachment = Attachment.create(dto);

    await this.repository.create(attachment);

    return attachment;
  }

  async getAttachment(id: string): Promise<Attachment> {
    const attachment = await this.repository.findById(
      AttachmentId.fromString(id),
    );

    if (!attachment) {
      throw new NotFoundError("Attachment not found.");
    }

    return attachment;
  }

  async listByNote(noteId: string): Promise<Attachment[]> {
    return this.repository.findByNote(noteId);
  }

  async deleteAttachment(id: string): Promise<void> {
    const attachment = await this.getAttachment(id);

    await this.repository.delete(attachment.Id);
    await this.fileStore.delete(attachment.Url);
  }
}
