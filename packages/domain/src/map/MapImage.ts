import { ValidationError } from "../shared";
import { MapImageId } from "./MapImageId";

const VALID_MIME_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

export interface CreateMapImageProps {
  campaignId: string;
  url: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  width: number;
  height: number;
}

export interface RehydrateMapImageProps extends CreateMapImageProps {
  id: MapImageId;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReplaceMapImageProps {
  url: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  width: number;
  height: number;
}

// A campaign's custom map background (KAN-52) — one per campaign
// (@@unique([campaignId]) at the Prisma layer), rendered as a Leaflet
// CRS.Simple ImageOverlay instead of the KAN-50 tile layer when present.
// Re-uploading replaces this in place (replaceImage) rather than deleting
// and recreating, same idiom as WorkspaceState.replaceState — there's no
// history/audit need for "what the map background used to be".
export class MapImage {
  private constructor(
    private readonly idValue: MapImageId,
    private readonly campaignIdValue: string,
    private urlValue: string,
    private fileNameValue: string,
    private mimeTypeValue: string,
    private sizeBytesValue: number,
    private widthValue: number,
    private heightValue: number,
    private readonly createdAtValue: Date,
    private updatedAtValue: Date,
  ) {
    this.validateFileName(fileNameValue);
    this.validateMimeType(mimeTypeValue);
    this.validateDimensions(widthValue, heightValue);
  }

  static create(props: CreateMapImageProps): MapImage {
    return new MapImage(
      MapImageId.create(),
      props.campaignId,
      props.url,
      props.fileName,
      props.mimeType,
      props.sizeBytes,
      props.width,
      props.height,
      new Date(),
      new Date(),
    );
  }

  static rehydrate(props: RehydrateMapImageProps): MapImage {
    return new MapImage(
      props.id,
      props.campaignId,
      props.url,
      props.fileName,
      props.mimeType,
      props.sizeBytes,
      props.width,
      props.height,
      props.createdAt,
      props.updatedAt,
    );
  }

  get Id(): MapImageId {
    return this.idValue;
  }

  get CampaignId(): string {
    return this.campaignIdValue;
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

  get Width(): number {
    return this.widthValue;
  }

  get Height(): number {
    return this.heightValue;
  }

  get CreatedAt(): Date {
    return this.createdAtValue;
  }

  get UpdatedAt(): Date {
    return this.updatedAtValue;
  }

  replaceImage(props: ReplaceMapImageProps): void {
    this.validateFileName(props.fileName);
    this.validateMimeType(props.mimeType);
    this.validateDimensions(props.width, props.height);

    this.urlValue = props.url;
    this.fileNameValue = props.fileName;
    this.mimeTypeValue = props.mimeType;
    this.sizeBytesValue = props.sizeBytes;
    this.widthValue = props.width;
    this.heightValue = props.height;
    this.updatedAtValue = new Date();
  }

  private validateFileName(fileName: string): void {
    if (!fileName.trim()) {
      throw new ValidationError("Map image file name cannot be empty.");
    }

    if (fileName.length > 255) {
      throw new ValidationError(
        "Map image file name cannot exceed 255 characters.",
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

  private validateDimensions(width: number, height: number): void {
    if (!Number.isInteger(width) || width <= 0) {
      throw new ValidationError("Map image width must be a positive integer.");
    }

    if (!Number.isInteger(height) || height <= 0) {
      throw new ValidationError("Map image height must be a positive integer.");
    }
  }
}
