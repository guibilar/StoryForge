import { ValidationError } from "../shared";
import { AttachmentId } from "./AttachmentId";

const VALID_MIME_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

export interface CreateAttachmentProps {
  noteId: string;
  url: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

export interface RehydrateAttachmentProps {
  id: AttachmentId;
  noteId: string;
  url: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: Date;
}

export class Attachment {
  private constructor(
    private readonly idValue: AttachmentId,
    private readonly noteIdValue: string,
    private readonly urlValue: string,
    private readonly fileNameValue: string,
    private readonly mimeTypeValue: string,
    private readonly sizeBytesValue: number,
    private readonly createdAtValue: Date,
  ) {
    this.validateFileName(fileNameValue);
    this.validateMimeType(mimeTypeValue);
  }

  static create(props: CreateAttachmentProps): Attachment {
    return new Attachment(
      AttachmentId.create(),
      props.noteId,
      props.url,
      props.fileName,
      props.mimeType,
      props.sizeBytes,
      new Date(),
    );
  }

  static rehydrate(props: RehydrateAttachmentProps): Attachment {
    return new Attachment(
      props.id,
      props.noteId,
      props.url,
      props.fileName,
      props.mimeType,
      props.sizeBytes,
      props.createdAt,
    );
  }

  get Id(): AttachmentId {
    return this.idValue;
  }

  get NoteId(): string {
    return this.noteIdValue;
  }

  get Url(): string {
    return this.urlValue;
  }

  get FileName(): string {
    return this.fileNameValue;
  }

  get MimeType(): string {
    return this.mimeTypeValue;
  }

  get SizeBytes(): number {
    return this.sizeBytesValue;
  }

  get CreatedAt(): Date {
    return this.createdAtValue;
  }

  private validateFileName(fileName: string): void {
    if (fileName.length > 255) {
      throw new ValidationError(
        "Attachment file name cannot exceed 255 characters.",
      );
    }
  }

  private validateMimeType(mimeType: string): void {
    if (!VALID_MIME_TYPES.includes(mimeType)) {
      throw new ValidationError(
        "Invalid file type. Only JPEG, PNG, GIF, and WEBP are allowed.",
      );
    }
  }
}
