import "server-only";
import { prisma } from "@/lib/prisma";
import {
  effectiveEditableLimit,
  resolveSimulationEntitlement,
} from "@/lib/billing/simulation-entitlement";
import { completedPerformanceSessionWhere } from "@/lib/session-report-performance";
import { normalizeTrentesimiScore } from "@/lib/scoring/trentesimi";
import { isPlatformAdminEmail } from "@/lib/auth/platform-admins";

export type AdminUserSessionRow = {
  caseTitle: string;
  score: number;
  completedAt: string | null;
};

export type AdminUserRow = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  createdAt: string;
  isActive: boolean;
  freeSimulationLimit: number | null;
  isPlatformAdmin: boolean;
  startedCount: number;
  completedCount: number;
  avgScore: number | null;
  limitLabel: string;
  editableLimit: number | "unlimited";
  remaining: number | null;
  unlimited: boolean;
  recentSessions: AdminUserSessionRow[];
};

function formatLimitLabel(row: {
  unlimited: boolean;
  source: string;
  lifetimeLimit: number | null;
  startedCount: number;
}): string {
  if (row.unlimited) return "Illimitato";
  if (row.lifetimeLimit != null) {
    const source =
      row.source === "sponsored"
        ? "omaggio"
        : row.source === "pilot"
          ? "pilota"
          : row.source === "override"
            ? "assegnati"
            : "casi";
    return `${row.startedCount}/${row.lifetimeLimit} ${source}`;
  }
  return "3 al giorno";
}

export async function listAdminUsers(): Promise<AdminUserRow[]> {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
      isActive: true,
      freeSimulationLimit: true,
    },
  });

  if (users.length === 0) return [];

  const userIds = users.map((user) => user.id);

  const [startedGroups, scoreGroups, recentReports] = await Promise.all([
    prisma.caseSession.groupBy({
      by: ["userId"],
      where: { userId: { in: userIds } },
      _count: { _all: true },
    }),
    prisma.sessionReport.groupBy({
      by: ["userId"],
      where: completedPerformanceSessionWhere({ userId: { in: userIds } }),
      _count: { _all: true },
      _avg: { totalScore: true },
    }),
    prisma.sessionReport.findMany({
      where: completedPerformanceSessionWhere({ userId: { in: userIds } }),
      orderBy: [{ completedAt: "desc" }, { createdAt: "desc" }],
      select: {
        userId: true,
        totalScore: true,
        completedAt: true,
        case: { select: { title: true } },
      },
      take: 400,
    }),
  ]);

  const startedByUser = new Map(startedGroups.map((row) => [row.userId, row._count._all]));
  const scoresByUser = new Map(
    scoreGroups.map((row) => [
      row.userId,
      {
        completedCount: row._count._all,
        avgScore: normalizeTrentesimiScore(row._avg.totalScore),
      },
    ]),
  );
  const recentByUser = new Map<string, AdminUserSessionRow[]>();
  for (const report of recentReports) {
    const list = recentByUser.get(report.userId) ?? [];
    if (list.length >= 5) continue;
    const score = normalizeTrentesimiScore(report.totalScore);
    list.push({
      caseTitle: report.case?.title?.trim() || "Caso clinico",
      score: score ?? 0,
      completedAt: report.completedAt?.toISOString() ?? null,
    });
    recentByUser.set(report.userId, list);
  }

  return users.map((user) => {
    const entitlement = resolveSimulationEntitlement(user);
    const startedCount = startedByUser.get(user.id) ?? 0;
    const scores = scoresByUser.get(user.id);
    const remaining =
      entitlement.unlimited || entitlement.lifetimeLimit == null
        ? null
        : Math.max(0, entitlement.lifetimeLimit - startedCount);

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      createdAt: user.createdAt.toISOString(),
      isActive: user.isActive,
      freeSimulationLimit: user.freeSimulationLimit,
      isPlatformAdmin: isPlatformAdminEmail(user.email),
      startedCount,
      completedCount: scores?.completedCount ?? 0,
      avgScore: scores?.avgScore ?? null,
      limitLabel: formatLimitLabel({
        unlimited: entitlement.unlimited,
        source: entitlement.source,
        lifetimeLimit: entitlement.lifetimeLimit,
        startedCount,
      }),
      editableLimit: effectiveEditableLimit(user),
      remaining,
      unlimited: entitlement.unlimited,
      recentSessions: recentByUser.get(user.id) ?? [],
    };
  });
}
