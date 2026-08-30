/**
 * Ensure platform Google accounts exist as ADMIN in the database.
 *
 * Usage:
 *   npx tsx scripts/ensure-platform-admins.ts
 *
 * Loads DATABASE_URL from .env / .env.local.
 */
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import { PLATFORM_ADMIN_EMAILS } from "../lib/auth/platform-admins";

loadEnv({ path: resolve(process.cwd(), ".env.local") });
loadEnv({ path: resolve(process.cwd(), ".env") });

const NAMES: Record<string, string> = {
  "dariobarbagallo46@gmail.com": "Dario Barbagallo",
  "dario.barbagallo46@gmail.com": "Dario Barbagallo",
  "chris01.ugo@gmail.com": "Christopher Uguzzoni",
  "chris01ugo@gmail.com": "Christopher Uguzzoni",
};

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error("DATABASE_URL is not set. Configure .env.local before running.");
  }

  const prisma = new PrismaClient();
  try {
    const rows = [];
    for (const email of PLATFORM_ADMIN_EMAILS) {
      const normalized = email.toLowerCase();
      const user = await prisma.user.upsert({
        where: { email: normalized },
        create: {
          email: normalized,
          name: NAMES[normalized] ?? normalized,
          role: "ADMIN",
          planType: "BETA_TESTER",
          termsAcceptedAt: new Date(),
          privacyAcceptedAt: new Date(),
        },
        update: {
          role: "ADMIN",
          planType: "BETA_TESTER",
          name: NAMES[normalized] ?? undefined,
        },
        select: { id: true, email: true, role: true, planType: true, name: true },
      });
      rows.push(user);
    }
    console.log("Platform admins ensured:");
    console.table(rows);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
