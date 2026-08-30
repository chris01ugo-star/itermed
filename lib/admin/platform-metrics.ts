import { prisma } from "@/lib/prisma";
import { completedPerformanceSessionWhere } from "@/lib/session-report-performance";

export type PlatformMetrics = {
  usersTotal: number;
  usersAdmins: number;
  usersLast7Days: number;
  waitlistTotal: number;
  waitlistLast7Days: number;
  simulationsStarted: number;
  simulationsStartedLast7Days: number;
  simulationsCompleted: number;
  simulationsCompletedLast7Days: number;
  reportsPending: number;
  activeCases: number;
  waitlistAvailable: boolean;
};

export type WaitlistRow = {
  id: string;
  email: string;
  name: string | null;
  roleHint: string | null;
  source: string;
  createdAt: Date;
};

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

export async function fetchPlatformMetrics(): Promise<PlatformMetrics> {
  const since7d = daysAgo(7);
  const completed = completedPerformanceSessionWhere();
  const completedRecent = completedPerformanceSessionWhere({
    OR: [{ completedAt: { gte: since7d } }, { createdAt: { gte: since7d } }],
  });

  const [
    usersTotal,
    usersAdmins,
    usersLast7Days,
    simulationsStarted,
    simulationsStartedLast7Days,
    simulationsCompleted,
    simulationsCompletedLast7Days,
    reportsPending,
    activeCases,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { role: "ADMIN" } }),
    prisma.user.count({ where: { createdAt: { gte: since7d } } }),
    prisma.caseSession.count(),
    prisma.caseSession.count({ where: { createdAt: { gte: since7d } } }),
    prisma.sessionReport.count({ where: completed }),
    prisma.sessionReport.count({ where: completedRecent }),
    prisma.sessionReport.count({
      where: { status: { in: ["PENDING", "PROCESSING"] } },
    }),
    prisma.clinicalCase.count({ where: { isActive: true } }),
  ]);

  let waitlistTotal = 0;
  let waitlistLast7Days = 0;
  let waitlistAvailable = true;
  try {
    [waitlistTotal, waitlistLast7Days] = await Promise.all([
      prisma.betaWaitlistEntry.count(),
      prisma.betaWaitlistEntry.count({ where: { createdAt: { gte: since7d } } }),
    ]);
  } catch {
    waitlistAvailable = false;
  }

  return {
    usersTotal,
    usersAdmins,
    usersLast7Days,
    waitlistTotal,
    waitlistLast7Days,
    simulationsStarted,
    simulationsStartedLast7Days,
    simulationsCompleted,
    simulationsCompletedLast7Days,
    reportsPending,
    activeCases,
    waitlistAvailable,
  };
}

export async function fetchWaitlistEntries(limit = 200): Promise<WaitlistRow[]> {
  try {
    return await prisma.betaWaitlistEntry.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        email: true,
        name: true,
        roleHint: true,
        source: true,
        createdAt: true,
      },
    });
  } catch {
    return [];
  }
}
