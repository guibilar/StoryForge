import { fileURLToPath } from "node:url";

try {
  process.loadEnvFile(fileURLToPath(new URL("./.env", import.meta.url)));
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
    throw error;
  }
}
