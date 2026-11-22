/**
 * Node-only dotenv bootstrap for scripts and Prisma. Do not import from Edge routes.
 */
export function loadEnvFromDisk(): void {
  if (typeof window !== "undefined") return;
  if (process.env.NEXT_RUNTIME === "edge") return;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { existsSync } = require("node:fs") as typeof import("node:fs");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require("node:path") as typeof import("node:path");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const dotenv = require("dotenv") as typeof import("dotenv");

    const candidateFiles = [
      path.resolve(process.cwd(), ".env.local"),
      path.resolve(process.cwd(), ".env"),
      path.resolve(process.cwd(), "itermed", ".env.local"),
      path.resolve(process.cwd(), "itermed", ".env"),
    ];

    for (const file of candidateFiles) {
      if (!existsSync(file)) continue;
      dotenv.config({ path: file });
      if (process.env.DATABASE_URL && process.env.OPENAI_API_KEY) {
        return;
      }
    }
  } catch {
    // Non-fatal: Next.js may already have injected env vars.
  }
}

loadEnvFromDisk();
