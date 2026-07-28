import type { Prisma } from "@prisma/client";

/**
 * Completed reports that count toward averages, radar, charts, and leaderboards.
 * Dismiss / early-abandon writes (`rawTrace.dismissed: true`) must not dilute metrics.
 *
 * IMPORTANT: do NOT use `NOT: { rawTrace: { path: ["dismissed"], equals: true } }`.
 * On Postgres, a missing JSON key makes the comparison NULL, so `NOT NULL` drops the row
 * and every normal (non-dismissed) report disappears from the dashboard.
 */
export function completedPerformanceSessionWhere(
  extra: Prisma.SessionReportWhereInput = {},
): Prisma.SessionReportWhereInput {
  return {
    AND: [
      { status: "COMPLETED" },
      extra,
      {
        OR: [
          // Explicit non-dismiss (written by buildSessionReportData going forward).
          { rawTrace: { path: ["dismissed"], equals: false } },
          // Normal evaluations always persist killerSwitch; dismissals do not.
          { rawTrace: { path: ["killerSwitch", "applied"], equals: false } },
          { rawTrace: { path: ["killerSwitch", "applied"], equals: true } },
        ],
      },
    ],
  };
}
