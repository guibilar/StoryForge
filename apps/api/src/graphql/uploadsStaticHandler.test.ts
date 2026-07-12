import { describe, expect, it } from "vitest";
import { sep } from "node:path";
import {
  contentTypeFor,
  isUploadsRequest,
  resolveUploadPath,
} from "./uploadsStaticHandler";

const uploadsDir = "/srv/storyforge/uploads";

describe("isUploadsRequest", () => {
  it("matches paths under /uploads/", () => {
    expect(isUploadsRequest("/uploads/entity-1/a.png")).toBe(true);
  });

  it("rejects other paths", () => {
    expect(isUploadsRequest("/graphql")).toBe(false);
  });
});

describe("resolveUploadPath", () => {
  it("resolves a normal path under uploadsDir", () => {
    const resolved = resolveUploadPath("/uploads/entity-1/a.png", uploadsDir);

    expect(resolved).toBe(`${uploadsDir}${sep}entity-1${sep}a.png`);
  });

  it("rejects traversal outside uploadsDir", () => {
    const resolved = resolveUploadPath("/uploads/../../etc/passwd", uploadsDir);

    expect(resolved).toBeNull();
  });

  it("rejects traversal encoded within a segment", () => {
    const resolved = resolveUploadPath(
      "/uploads/entity-1/..%2f..%2fetc%2fpasswd",
      uploadsDir,
    );

    expect(resolved).toBeNull();
  });
});

describe("contentTypeFor", () => {
  it("maps known extensions", () => {
    expect(contentTypeFor("/a/b.png")).toBe("image/png");
    expect(contentTypeFor("/a/b.JPG")).toBe("image/jpeg");
  });

  it("falls back to octet-stream for unknown extensions", () => {
    expect(contentTypeFor("/a/b.exe")).toBe("application/octet-stream");
  });
});
