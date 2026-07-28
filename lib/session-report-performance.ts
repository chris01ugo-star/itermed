import type { Prisma } from "@prisma/client";

/**
 * Completed reports that count toward averages, radar, charts, and leaderboards.
 * Dismiss / early-abandon writes (`rawTrace.dismissed: true`) keep score 0 by policy
 * but must not dilute performance metrics (unlike killer-switch clinical fails).
 */
export function completedPerformanceSessionWhere(
  extra: Prisma.SessionReportWhereInput = {},
): Prisma.SessionReportWhereInput {
  return {
    AND: [
      { status: "COMPLETED" },
      {
        NOT: {
          rawTrace: {
            path: ["dismissed"],
            equals: true,
          },
        },
      },
      extra,
    ],
  };
}
