import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { ValidationError } from "@storyforge/domain";
import { UPLOADS_DIR } from "../../../config/env";

const VALID_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;

export interface UploadableFile {
  name: string;
  type: string;
  arrayBuffer(): Promise<ArrayBuffer>;
}

export class LocalImageStore {
  async save(entityId: string, file: UploadableFile): Promise<string> {
    if (!VALID_TYPES.includes(file.type)) {
      throw new ValidationError(
        "Invalid file type. Only JPEG, PNG, GIF, and WEBP are allowed.",
      );
    }

    if (file.name.length > 255) {
      throw new ValidationError(
        "File name is too long. Maximum length is 255 characters.",
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    if (buffer.byteLength > MAX_BYTES) {
      throw new ValidationError("File size exceeds the maximum limit of 5MB.");
    }

    const ext = file.name.split(".").pop();
    const filename = `${crypto.randomUUID()}.${ext}`;
    const diskPath = join(UPLOADS_DIR, entityId, filename);

    await mkdir(dirname(diskPath), { recursive: true });
    await writeFile(diskPath, buffer);

    return `/uploads/${entityId}/${filename}`;
  }
}
