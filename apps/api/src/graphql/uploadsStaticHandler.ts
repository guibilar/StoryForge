import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize, resolve, sep } from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";

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

export function contentTypeFor(path: string): string {
  return (
    CONTENT_TYPES[extname(path).toLowerCase()] ?? "application/octet-stream"
  );
}

export function serveUpload(
  req: IncomingMessage,
  res: ServerResponse,
  uploadsDir: string,
): void {
  const url = req.url ?? "";
  const path = resolveUploadPath(url, uploadsDir);

  if (!path || !existsSync(path) || !statSync(path).isFile()) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  res.writeHead(200, { "Content-Type": contentTypeFor(path) });
  createReadStream(path).pipe(res);
}
