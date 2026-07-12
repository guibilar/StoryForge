import { beforeEach, describe, expect, it, vi } from "vitest";
import { ValidationError } from "@storyforge/domain";

const mkdir = vi.fn();
const writeFile = vi.fn();

vi.mock("node:fs/promises", () => ({
  mkdir: (...args: unknown[]) => mkdir(...args),
  writeFile: (...args: unknown[]) => writeFile(...args),
}));

vi.mock("../../../config/env", () => ({
  UPLOADS_DIR: "/tmp/storyforge-uploads",
}));

import { LocalImageStore } from "./LocalImageStore";
import type { UploadableFile } from "./LocalImageStore";

function makeFile(overrides: Partial<UploadableFile> = {}): UploadableFile {
  return {
    name: "portrait.png",
    type: "image/png",
    arrayBuffer: async () => new ArrayBuffer(1024),
    ...overrides,
  };
}

describe("LocalImageStore", () => {
  let store: LocalImageStore;

  beforeEach(() => {
    store = new LocalImageStore();
    mkdir.mockReset().mockResolvedValue(undefined);
    writeFile.mockReset().mockResolvedValue(undefined);
  });

  it("creates the entity's directory and writes the file", async () => {
    const path = await store.save("entity-1", makeFile());

    expect(mkdir).toHaveBeenCalledWith("/tmp/storyforge-uploads/entity-1", {
      recursive: true,
    });
    expect(writeFile).toHaveBeenCalledTimes(1);
    expect(path).toMatch(/^\/uploads\/entity-1\/[0-9a-f-]+\.png$/);
  });

  it("rejects a disallowed mime type", async () => {
    await expect(
      store.save("entity-1", makeFile({ type: "application/pdf" })),
    ).rejects.toThrow(ValidationError);
    expect(writeFile).not.toHaveBeenCalled();
  });

  it("rejects a file over the 5MB limit", async () => {
    const oversized = makeFile({
      arrayBuffer: async () => new ArrayBuffer(5 * 1024 * 1024 + 1),
    });

    await expect(store.save("entity-1", oversized)).rejects.toThrow(
      ValidationError,
    );
    expect(writeFile).not.toHaveBeenCalled();
  });

  it("rejects an overly long file name", async () => {
    const longName = `${"a".repeat(256)}.png`;

    await expect(
      store.save("entity-1", makeFile({ name: longName })),
    ).rejects.toThrow(ValidationError);
    expect(writeFile).not.toHaveBeenCalled();
  });
});
