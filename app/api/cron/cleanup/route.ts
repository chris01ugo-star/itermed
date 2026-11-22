import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";

export const runtime = "nodejs";
export const maxDuration = 300;

const log = createLogger("cron-cleanup");

/** Abandoned sessions and stuck reports older than this are eligible for cleanup. */
const STALE_AFTER_MS = 48 * 60 * 60 * 1000;

function headerMatchesSecret(header: string, secret: string): boolean {
  const candidates = [secret, `Bearer ${secret}`];
  const provided = Buffer.from(header);
  for (const expected of candidates) {
    const target = Buffer.from(expected);
    if (provided.length !== target.length) continue;
    if (timingSafeEqual(provided, target)) return true;
  }
  return false;
}

function isAuthorizedCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const header = req.headers.get("authorization")?.trim() ?? "";
  if (!header) return false;
  return headerMatchesSecret(header, secret);
}

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Nightly Vercel Cron: delete CaseSession rows abandoned for 48 hours
 * and mark stuck PENDING/PROCESSING reports as FAILED.
 * Sessions linked to any SessionReport, and reports already COMPLETED, are kept.
 *
 * Auth: `Authorization` must equal `CRON_SECRET` or `Bearer ${CRON_SECRET}`.
 */
export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) {
    return json({ error: "Unauthorized", code: "UNAUTHORIZED" }, 401);
  }

  const cutoff = new Date(Date.now() - STALE_AFTER_MS);

  try {
    const deletedSessions = await prisma.$executeRaw`
      DELETE FROM "CaseSession" AS cs
      WHERE cs."updatedAt" < ${cutoff}
      AND NOT EXISTS (
        SELECT 1 FROM "SessionReport" AS sr
        WHERE sr."userId" = cs."userId"
          AND sr."caseId" = cs."caseId"
      )
      AND NOT EXISTS (
        SELECT 1 FROM "SessionReport" AS sr
        WHERE sr."rawTrace"->>'liveSessionId' = cs."id"
           OR sr."rawTrace"->'jobQueue'->>'liveSessionId' = cs."id"
      )
    `;

    const stuckReports = await prisma.sessionReport.updateMany({
      where: {
        status: { in: ["PENDING", "PROCESSING"] },
        updatedAt: { lt: cutoff },
      },
      data: {
        status: "FAILED",
        progressMessage: "Elaborazione interrotta: timeout oltre 48 ore.",
      },
    });

    log.info("Cron cleanup completed", {
      cutoff: cutoff.toISOString(),
      deletedSessions,
      failedStuckReports: stuckReports.count,
    });

    return json(
      {
        ok: true,
        cutoff: cutoff.toISOString(),
        deletedSessions,
        failedStuckReports: stuckReports.count,
      },
      200,
    );
  } catch (error) {
    log.error("Cron cleanup failed", { error });
    return json({ error: "Cleanup failed", code: "CLEANUP_FAILED" }, 500);
  }
}
