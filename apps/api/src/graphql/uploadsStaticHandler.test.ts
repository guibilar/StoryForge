import { describe, expect, it, vi, beforeEach } from "vitest";
import { sep } from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";

const jwtVerify = vi.fn();
vi.mock("jsonwebtoken", () => ({
  default: { verify: (...a: unknown[]) => jwtVerify(...a) },
}));

const entityFindUnique = vi.fn();
const noteFindUnique = vi.fn();
const campaignFindUnique = vi.fn();
const campaignMemberFindUnique = vi.fn();
vi.mock("@storyforge/database", () => ({
  prisma: {
    entity: { findUnique: (...a: unknown[]) => entityFindUnique(...a) },
    note: { findUnique: (...a: unknown[]) => noteFindUnique(...a) },
    campaign: { findUnique: (...a: unknown[]) => campaignFindUnique(...a) },
    campaignMember: {
      findUnique: (...a: unknown[]) => campaignMemberFindUnique(...a),
    },
  },
}));

vi.mock("../config/env", () => ({ JWT_SECRET: "test-secret" }));

const existsSync = vi.fn();
const statSync = vi.fn();
const pipe = vi.fn();
const createReadStream = vi.fn(() => ({ pipe }));
vi.mock("node:fs", () => ({
  existsSync: (...a: unknown[]) => existsSync(...a),
  statSync: (...a: unknown[]) => statSync(...a),
  createReadStream: (...a: unknown[]) => createReadStream(...a),
}));

const {
  contentTypeFor,
  isUploadsRequest,
  ownerIdFor,
  resolveUploadPath,
  serveUpload,
} = await import("./uploadsStaticHandler");

function makeReq(url: string, cookie?: string): IncomingMessage {
  return { url, headers: { cookie } } as unknown as IncomingMessage;
}

function makeRes(): ServerResponse & {
  writeHead: ReturnType<typeof vi.fn>;
  end: ReturnType<typeof vi.fn>;
} {
  return {
    writeHead: vi.fn(),
    end: vi.fn(),
  } as unknown as ServerResponse & {
    writeHead: ReturnType<typeof vi.fn>;
    end: ReturnType<typeof vi.fn>;
  };
}

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

  it("returns null instead of throwing on malformed percent-encoding", () => {
    expect(
      resolveUploadPath("/uploads/entity-1/%zz.png", uploadsDir),
    ).toBeNull();
    expect(resolveUploadPath("/uploads/%", uploadsDir)).toBeNull();
  });

  it("ignores a query string", () => {
    const resolved = resolveUploadPath(
      "/uploads/entity-1/a.png?v=123",
      uploadsDir,
    );

    expect(resolved).toBe(`${uploadsDir}${sep}entity-1${sep}a.png`);
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

describe("ownerIdFor", () => {
  it("extracts the first path segment as the owner id", () => {
    expect(ownerIdFor("/uploads/entity-1/a.png")).toBe("entity-1");
  });

  it("ignores a query string", () => {
    expect(ownerIdFor("/uploads/entity-1/a.png?v=1")).toBe("entity-1");
  });
});

describe("serveUpload", () => {
  beforeEach(() => {
    existsSync.mockReset().mockReturnValue(true);
    statSync.mockReset().mockReturnValue({ isFile: () => true });
    createReadStream.mockClear();
    pipe.mockClear();
    jwtVerify.mockReset();
    entityFindUnique.mockReset();
    noteFindUnique.mockReset();
    campaignFindUnique.mockReset();
    campaignMemberFindUnique.mockReset();
  });

  it("returns 404 when the file doesn't exist on disk", async () => {
    existsSync.mockReturnValue(false);
    const req = makeReq("/uploads/entity-1/a.png", "token=abc");
    const res = makeRes();

    await serveUpload(req, res, uploadsDir);

    expect(res.writeHead).toHaveBeenCalledWith(404);
  });

  it("returns 401 when there's no valid session cookie", async () => {
    const req = makeReq("/uploads/entity-1/a.png");
    const res = makeRes();

    await serveUpload(req, res, uploadsDir);

    expect(res.writeHead).toHaveBeenCalledWith(401);
  });

  it("returns 403 when the requester isn't a member of the owning campaign", async () => {
    jwtVerify.mockReturnValue({ sub: "user-1" });
    entityFindUnique.mockResolvedValue({ campaignId: "campaign-1" });
    campaignMemberFindUnique.mockResolvedValue(null);
    const req = makeReq("/uploads/entity-1/a.png", "token=abc");
    const res = makeRes();

    await serveUpload(req, res, uploadsDir);

    expect(res.writeHead).toHaveBeenCalledWith(403);
    expect(pipe).not.toHaveBeenCalled();
  });

  it("returns 403 when the owner id doesn't resolve to any entity, note, or campaign", async () => {
    jwtVerify.mockReturnValue({ sub: "user-1" });
    entityFindUnique.mockResolvedValue(null);
    noteFindUnique.mockResolvedValue(null);
    campaignFindUnique.mockResolvedValue(null);
    const req = makeReq("/uploads/deleted-1/a.png", "token=abc");
    const res = makeRes();

    await serveUpload(req, res, uploadsDir);

    expect(res.writeHead).toHaveBeenCalledWith(403);
  });

  it("serves the file when the requester is a campaign member", async () => {
    jwtVerify.mockReturnValue({ sub: "user-1" });
    entityFindUnique.mockResolvedValue({ campaignId: "campaign-1" });
    campaignMemberFindUnique.mockResolvedValue({
      campaignId: "campaign-1",
      userId: "user-1",
    });
    const req = makeReq("/uploads/entity-1/a.png", "token=abc");
    const res = makeRes();

    await serveUpload(req, res, uploadsDir);

    expect(res.writeHead).toHaveBeenCalledWith(200, {
      "Content-Type": "image/png",
    });
    expect(pipe).toHaveBeenCalledWith(res);
  });

  it("falls back to the note when the owner id isn't an entity", async () => {
    jwtVerify.mockReturnValue({ sub: "user-1" });
    entityFindUnique.mockResolvedValue(null);
    noteFindUnique.mockResolvedValue({ campaignId: "campaign-2" });
    campaignMemberFindUnique.mockResolvedValue({
      campaignId: "campaign-2",
      userId: "user-1",
    });
    const req = makeReq("/uploads/note-1/a.png", "token=abc");
    const res = makeRes();

    await serveUpload(req, res, uploadsDir);

    expect(res.writeHead).toHaveBeenCalledWith(200, {
      "Content-Type": "image/png",
    });
  });

  it("falls back to treating the owner id as a campaign id (map image)", async () => {
    jwtVerify.mockReturnValue({ sub: "user-1" });
    entityFindUnique.mockResolvedValue(null);
    noteFindUnique.mockResolvedValue(null);
    campaignFindUnique.mockResolvedValue({ id: "campaign-3" });
    campaignMemberFindUnique.mockResolvedValue({
      campaignId: "campaign-3",
      userId: "user-1",
    });
    const req = makeReq("/uploads/campaign-3/a.png", "token=abc");
    const res = makeRes();

    await serveUpload(req, res, uploadsDir);

    expect(res.writeHead).toHaveBeenCalledWith(200, {
      "Content-Type": "image/png",
    });
  });
});
