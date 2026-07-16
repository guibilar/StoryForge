export interface CookieOptions {
  maxAge?: number;
}

export const AUTH_COOKIE_NAME = "token";
export const AUTH_COOKIE_MAX_AGE = 8 * 60 * 60;

export function serializeCookie(
  name: string,
  value: string,
  options: CookieOptions = {},
): string {
  const attrs = ["Path=/", "HttpOnly", "SameSite=Lax"];

  if (process.env.NODE_ENV === "production") {
    attrs.push("Secure");
  }

  if (options.maxAge !== undefined) {
    attrs.push(`Max-Age=${options.maxAge}`);
  }

  return `${name}=${value}; ${attrs.join("; ")}`;
}

export function parseCookie(
  cookieHeader: string | null,
  name: string,
): string | null {
  if (!cookieHeader) {
    return null;
  }

  for (const part of cookieHeader.split(";")) {
    const separatorIndex = part.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = part.slice(0, separatorIndex).trim();

    if (key === name) {
      return part.slice(separatorIndex + 1).trim();
    }
  }

  return null;
}
