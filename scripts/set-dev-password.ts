/**
 * Set (or reset) the password for a local dev user — handy to log in with the
 * seeded admin account (test@itermed.com) now that DEV_AUTH_BYPASS is off.
 *
 * Usage:
 *   npx tsx scripts/set-dev-password.ts --email=test@itermed.com --password=devpass123
 *
 * Loads DATABASE_URL from .env.local / .env (same as the app). Creates the
 * user (role STUDENT) if it doesn't exist yet.
 */
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

loadEnv({ path: resolve(process.cwd(), ".env.local") });
loadEnv({ path: resolve(process.cwd(), ".env") });

const emailFlag = process.argv.find((a) => a.startsWith("--email="));
const passwordFlag = process.argv.find((a) => a.startsWith("--password="));

const email = emailFlag?.slice("--email=".length)?.trim().toLowerCase();
const password = passwordFlag?.slice("--password=".length)?.trim();

async function main() {
  if (!email || !password) {
    console.error("Usage: npx tsx scripts/set-dev-password.ts --email=you@example.com --password=yourpassword");
    process.exit(1);
  }
  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }
  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error("DATABASE_URL is not set. Configure .env.local before running.");
  }

  const prisma = new PrismaClient();
  try {
    const passwordHash = await hash(password, 12);
    const user = await prisma.user.upsert({
      where: { email },
      update: { passwordHash },
      create: { email, passwordHash, role: "STUDENT" },
    });
    console.log(`✅ Password set for ${user.email} (role: ${user.role}, id: ${user.id})`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
