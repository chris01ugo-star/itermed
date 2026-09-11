import { PrismaClient } from "@prisma/client";
import { config } from "@/lib/config";
import {
  getPooledDatabaseUrl,
  isNeonPoolerUrl,
  resolveRuntimeDatabaseUrl,
} from "@/lib/database-url";
import { createLogger } from "@/lib/logger";

const prismaLogger = createLogger("prisma");

/**
 * Prevents connection exhaustion under HMR / concurrent serverless invocations
 * by reusing a single PrismaClient on `globalThis`.
 */
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaDelegateRepairAttempted?: boolean;
};

const rawRuntimeUrl = resolveRuntimeDatabaseUrl() || config.DATABASE_URL;
const datasourceUrl = getPooledDatabaseUrl(rawRuntimeUrl);

if (!config.isTest && !isNeonPoolerUrl(datasourceUrl)) {
  prismaLogger.warn(
    "DATABASE_URL is not using Neon pooler (-pooler / pgbouncer=true). Under heavy load you may exhaust connections. Set DATABASE_POOL_URL or POSTGRES_PRISMA_URL to the Neon pooled connection string, or use a host containing -pooler.",
  );
} else if (!config.isTest && isNeonPoolerUrl(datasourceUrl)) {
  prismaLogger.info("Prisma datasource using Neon pooled connection");
}

function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    datasources: {
      db: { url: datasourceUrl },
    },
    log: config.isDevelopment ? ["warn", "error"] : ["error"],
  });
}

/** True when this PrismaClient includes the `Medication` model (`prisma.medication`). */
function hasMedicationDelegate(client: PrismaClient): boolean {
  const delegate = (client as unknown as { medication?: { findMany?: unknown } }).medication;
  return typeof delegate?.findMany === "function";
}

/**
 * Returns a PrismaClient that includes current schema delegates.
 * Recreates the HMR singleton if it was built before `Medication` existed
 * (`prisma.medication` would otherwise be undefined → findMany crash).
 */
export function getPrismaClient(): PrismaClient {
  const existing = globalForPrisma.prisma;
  if (existing && hasMedicationDelegate(existing)) {
    return existing;
  }
  if (existing && !hasMedicationDelegate(existing)) {
    if (globalForPrisma.prismaDelegateRepairAttempted) {
      return existing;
    }
    globalForPrisma.prismaDelegateRepairAttempted = true;
    prismaLogger.warn(
      "Stale PrismaClient without Medication delegate — recreating once after prisma generate",
    );
    void existing.$disconnect().catch(() => undefined);
  }
  const created = createPrismaClient();
  globalForPrisma.prisma = created;
  return created;
}

export const prisma = getPrismaClient();
