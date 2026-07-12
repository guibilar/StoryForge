import { join } from "path";

function required(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export const JWT_SECRET = required("JWT_SECRET");
export const UPLOADS_DIR =
  process.env.UPLOADS_DIR ?? join(process.cwd(), "uploads");
