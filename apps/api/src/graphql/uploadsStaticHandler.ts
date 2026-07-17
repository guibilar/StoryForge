import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize, resolve, sep } from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import jwt from "jsonwebtoken";
import { prisma } from "@storyforge/database";

import { AUTH_COOKIE_NAME, parseCookie } from "./cookies";
import { JWT_SECRET } from "../config/env";

const CONTENT_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

const UPLOADS_PREFIX = "/uploads/";

export function isUploadsRequest(url: string): boolean {
  return url.startsWith(UPLOADS_PREFIX);
}

/**
 * Resolves a request URL to an absolute path under uploadsDir, rejecting
 * any path that would traverse outside of it (e.g. via `..` segments).
 * Returns null when the resolved path escapes uploadsDir, or when the URL
 * carries malformed percent-encoding (decodeURIComponent would throw, and
 * this runs synchronously in the http request listener — an uncaught throw
 * there kills the process).
 */
export function resolveUploadPath(
  url: string,
  uploadsDir: string,
): string | null {
  const pathname = url.split("?", 1)[0];

  let relative: string;
  try {
    relative = decodeURIComponent(pathname.slice(UPLOADS_PREFIX.length));
  } catch {
    return null;
  }

  const root = resolve(uploadsDir);
  const target = normalize(join(root, relative));

  if (target !== root && !target.startsWith(root + sep)) {
    return null;
  }

  return target;
}

/**
 * The first path segment after /uploads/ is always the id of the owning
 * record (entityId for profile images, noteId for note attachments) — the
 * directory files get written under, per LocalImageStore.save.
 */
export function ownerIdFor(url: string): string | null {
  const pathname = url.split("?", 1)[0];
  const relative = pathname.slice(UPLOADS_PREFIX.length);
  const [ownerId] = relative.split("/");

  return ownerId || null;
}

function getRequestUserId(req: IncomingMessage): string | null {
  const token = parseCookie(req.headers.cookie ?? null, AUTH_COOKIE_NAME);

  if (!token) {
    return null;
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"] });

    if (typeof payload === "string" || typeof payload.sub !== "string") {
      return null;
    }

    return payload.sub;
  } catch {
    return null;
  }
}

/**
 * Uploaded files live under a directory named for their owning Entity or
 * Note. Resolve whichever one matches to that record's campaignId so we can
 * check the requester is actually a member of that campaign.
 */
async function resolveCampaignId(ownerId: string): Promise<string | null> {
  const entity = await prisma.entity.findUnique({
    where: { id: ownerId },
    select: { campaignId: true },
  });

  if (entity) {
    return entity.campaignId;
  }

  const note = await prisma.note.findUnique({
    where: { id: ownerId },
    select: { campaignId: true },
  });

  return note?.campaignId ?? null;
}

async function isCampaignMember(
  campaignId: string,
  userId: string,
): Promise<boolean> {
  const membership = await prisma.campaignMember.findUnique({
    where: { campaignId_userId: { campaignId, userId } },
  });

  return membership !== null;
}

export function contentTypeFor(path: string): string {
  return (
    CONTENT_TYPES[extname(path).toLowerCase()] ?? "application/octet-stream"
  );
}

export async function serveUpload(
  req: IncomingMessage,
  res: ServerResponse,
  uploadsDir: string,
): Promise<void> {
  const url = req.url ?? "";
  const path = resolveUploadPath(url, uploadsDir);
  const ownerId = ownerIdFor(url);

  if (!path || !ownerId || !existsSync(path) || !statSync(path).isFile()) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  const userId = getRequestUserId(req);

  if (!userId) {
    res.writeHead(401);
    res.end("Unauthorized");
    return;
  }

  const campaignId = await resolveCampaignId(ownerId);

  if (!campaignId || !(await isCampaignMember(campaignId, userId))) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  res.writeHead(200, { "Content-Type": contentTypeFor(path) });
  createReadStream(path).pipe(res);
}
