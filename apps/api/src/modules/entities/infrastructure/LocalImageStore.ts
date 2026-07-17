import { mkdir, unlink, writeFile } from "node:fs/promises";
import { dirname, join, normalize, resolve, sep } from "node:path";
import { ValidationError } from "@storyforge/domain";
import { UPLOADS_DIR } from "../../../config/env";

const EXTENSION_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
};
const MAX_BYTES = 5 * 1024 * 1024;

export interface UploadableFile {
  name: string;
  type: string;
  arrayBuffer(): Promise<ArrayBuffer>;
}

export class LocalImageStore {
  async save(entityId: string, file: UploadableFile): Promise<string> {
    const ext = EXTENSION_BY_TYPE[file.type];

    if (!ext) {
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

    const filename = `${crypto.randomUUID()}.${ext}`;
    const diskPath = join(UPLOADS_DIR, entityId, filename);

    await mkdir(dirname(diskPath), { recursive: true });
    await writeFile(diskPath, buffer);

    return `/uploads/${entityId}/${filename}`;
  }

  /** Removes a previously saved file given the url returned by save(). */
  async delete(url: string): Promise<void> {
    const relative = url.replace(/^\/uploads\//, "");
    const root = resolve(UPLOADS_DIR);
    const diskPath = normalize(join(root, relative));

    if (diskPath !== root && !diskPath.startsWith(root + sep)) {
      return;
    }

    try {
      await unlink(diskPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
  }
}
