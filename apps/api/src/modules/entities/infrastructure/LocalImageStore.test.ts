import { beforeEach, describe, expect, it, vi } from "vitest";
import { ValidationError } from "@storyforge/domain";

const mkdir = vi.fn();
const writeFile = vi.fn();
const unlink = vi.fn();

vi.mock("node:fs/promises", () => ({
  mkdir: (...args: unknown[]) => mkdir(...args),
  writeFile: (...args: unknown[]) => writeFile(...args),
  unlink: (...args: unknown[]) => unlink(...args),
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
    unlink.mockReset().mockResolvedValue(undefined);
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

  it("derives the stored extension from the validated mime type, not the client-supplied file name", async () => {
    const path = await store.save(
      "entity-1",
      makeFile({ type: "image/png", name: "payload.svg" }),
    );

    expect(path).toMatch(/\.png$/);
  });

  describe("delete", () => {
    it("unlinks the file for a previously saved url", async () => {
      await store.delete("/uploads/entity-1/abc.png");

      expect(unlink).toHaveBeenCalledWith(
        "/tmp/storyforge-uploads/entity-1/abc.png",
      );
    });

    it("swallows ENOENT when the file is already gone", async () => {
      unlink.mockRejectedValue(
        Object.assign(new Error("not found"), { code: "ENOENT" }),
      );

      await expect(
        store.delete("/uploads/entity-1/abc.png"),
      ).resolves.toBeUndefined();
    });

    it("ignores urls that would traverse outside the uploads dir", async () => {
      await store.delete("/uploads/../../etc/passwd");

      expect(unlink).not.toHaveBeenCalled();
    });
  });
});
