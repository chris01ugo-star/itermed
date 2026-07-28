import type { LeaderboardNameType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resolveLeaderboardDisplayName } from "@/lib/leaderboard/leaderboard-display";
import { completedPerformanceSessionWhere } from "@/lib/session-report-performance";
import {
  normalizeTrentesimiScore,
  SQL_NORMALIZE_TRENTESIMI,
} from "@/lib/scoring/trentesimi";
import { sessionReportUserWhere } from "@/lib/statistics-user-scope";

export type LeaderboardEntry = {
  rank: number;
  displayName: string;
  averageScore: number;
  averageAccuracyPercent: number;
  sessionCount: number;
  isCurrentUser: boolean;
};

export type LeaderboardPreferences = {
  leaderboardOptIn: boolean;
  leaderboardNameType: LeaderboardNameType;
  nickname: string | null;
};

export type PersonalPerformanceMetrics = {
  averageScore: number | null;
  completedCount: number;
  rank: number | null;
  totalParticipants: number;
  percentileTop: number | null;
  clinicalResolutionRate: number | null;
  averageResolutionMinutes: number | null;
};

export type LeaderboardPayload = {
  top50: LeaderboardEntry[];
  currentUser: {
    rank: number | null;
    entry: LeaderboardEntry | null;
    preferences: LeaderboardPreferences;
    metrics: PersonalPerformanceMetrics;
  };
  generatedAt: string;
};

type RankedRow = {
  userId: string;
  avgScore: number;
  avgClinicalAccuracy: number;
  sessionCount: number;
  rank: bigint;
  name: string | null;
  nickname: string | null;
  nameType: LeaderboardNameType;
};

const TOP_LIMIT = 50;

async function fetchRankedLeaderboardRows(): Promise<RankedRow[]> {
  return prisma.$queryRawUnsafe<RankedRow[]>(`
    WITH "user_scores" AS (
      SELECT
        sr."userId" AS "userId",
        AVG(${SQL_NORMALIZE_TRENTESIMI})::float8 AS "avgScore",
        AVG(sr."clinicalAccuracy")::float8 AS "avgClinicalAccuracy",
        COUNT(*)::int AS "sessionCount"
      FROM "SessionReport" sr
      INNER JOIN "User" u ON u.id = sr."userId"
      WHERE sr.status = 'COMPLETED'
        AND (sr."rawTrace"->>'dismissed') IS DISTINCT FROM 'true'
        AND u."leaderboardOptIn" = true
      GROUP BY sr."userId"
      HAVING COUNT(*) >= 1
    ),
    "ranked" AS (
      SELECT
        us."userId",
        us."avgScore",
        us."avgClinicalAccuracy",
        us."sessionCount",
        RANK() OVER (ORDER BY us."avgScore" DESC, us."sessionCount" DESC) AS "rank"
      FROM "user_scores" us
    )
    SELECT
      r."userId",
      r."avgScore",
      r."avgClinicalAccuracy",
      r."sessionCount",
      r."rank",
      u.name,
      u.nickname,
      u."leaderboardNameType" AS "nameType"
    FROM "ranked" r
    INNER JOIN "User" u ON u.id = r."userId"
    ORDER BY r."rank" ASC
  `);
}

function toEntry(row: RankedRow, currentUserId: string): LeaderboardEntry {
  return {
    rank: Number(row.rank),
    displayName: resolveLeaderboardDisplayName({
      userId: row.userId,
      name: row.name,
      nickname: row.nickname,
      nameType: row.nameType,
    }),
    averageScore: normalizeTrentesimiScore(row.avgScore) ?? 0,
    averageAccuracyPercent: Math.round(row.avgClinicalAccuracy),
    sessionCount: row.sessionCount,
    isCurrentUser: row.userId === currentUserId,
  };
}

type CaseSessionTiming = {
  caseId: string;
  createdAt: Date;
  elapsedMinutes: number;
};

function resolveSimulationDurationMinutes(
  report: {
    caseId: string;
    startedAt: Date;
    completedAt: Date | null;
    createdAt: Date;
    rawTrace: unknown;
  },
  caseSessions: CaseSessionTiming[],
): number | null {
  const trace = report.rawTrace as { simulationElapsedMinutes?: unknown } | null;
  if (typeof trace?.simulationElapsedMinutes === "number" && trace.simulationElapsedMinutes > 0) {
    return trace.simulationElapsedMinutes;
  }

  const end = report.completedAt ?? report.createdAt;
  const matching = caseSessions.find(
    (cs) => cs.caseId === report.caseId && cs.createdAt.getTime() <= end.getTime(),
  );

  if (matching) {
    if (matching.elapsedMinutes > 0) return matching.elapsedMinutes;
    const wall = (end.getTime() - matching.createdAt.getTime()) / 60_000;
    if (wall >= 1) return wall;
  }

  const reportWall = report.completedAt
    ? (report.completedAt.getTime() - report.startedAt.getTime()) / 60_000
    : 0;
  // Report generation is usually < 1 min — ignore noise.
  if (reportWall >= 1) return reportWall;
  return null;
}

async function fetchPersonalPerformanceMetrics(
  userId: string,
  rank: number | null,
  totalParticipants: number,
): Promise<PersonalPerformanceMetrics & { averageAccuracyPercent: number | null }> {
  const performanceWhere = completedPerformanceSessionWhere(sessionReportUserWhere(userId));
  const [sessions, aggregate, caseSessions] = await Promise.all([
    prisma.sessionReport.findMany({
      where: performanceWhere,
      select: {
        totalScore: true,
        clinicalAccuracy: true,
        startedAt: true,
        completedAt: true,
        caseId: true,
        rawTrace: true,
        createdAt: true,
      },
    }),
    prisma.sessionReport.aggregate({
      where: performanceWhere,
      _avg: { clinicalAccuracy: true, totalScore: true },
    }),
    prisma.caseSession.findMany({
      where: { userId },
      select: {
        caseId: true,
        createdAt: true,
        elapsedMinutes: true,
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const completedCount = sessions.length;
  let averageScore: number | null = null;
  let clinicalResolutionRate: number | null = null;
  let averageResolutionMinutes: number | null = null;
  let averageAccuracyPercent: number | null = null;

  if (completedCount > 0) {
    const normalizedScores = sessions
      .map((s) => normalizeTrentesimiScore(s.totalScore))
      .filter((s): s is number => s != null);

    if (normalizedScores.length > 0) {
      const sum = normalizedScores.reduce((a, b) => a + b, 0);
      averageScore = Math.round((sum / normalizedScores.length) * 10) / 10;
    } else {
      averageScore = normalizeTrentesimiScore(aggregate._avg.totalScore);
    }

    const avgClinical = aggregate._avg.clinicalAccuracy;
    averageAccuracyPercent = avgClinical != null ? Math.round(avgClinical) : null;

    // Clinically "resolved" = clinical accuracy dimension at least sufficient (0–100).
    // Using totalScore ≥ 18/30 was too harsh on early/legacy scores and often showed 0%.
    const CLINICAL_ACCURACY_PASS = 55;
    const resolved = sessions.filter(
      (s) => (s.clinicalAccuracy ?? 0) >= CLINICAL_ACCURACY_PASS,
    ).length;
    clinicalResolutionRate = Math.round((resolved / completedCount) * 100);

    const durations = sessions
      .map((report) => resolveSimulationDurationMinutes(report, caseSessions))
      .filter((m): m is number => m != null && m > 0);

    if (durations.length > 0) {
      const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
      averageResolutionMinutes = Math.max(1, Math.round(avg));
    }
  }

  const percentileTop =
    rank != null && totalParticipants > 0
      ? Math.max(1, Math.ceil((rank / totalParticipants) * 100))
      : null;

  return {
    averageScore,
    completedCount,
    rank,
    totalParticipants,
    percentileTop,
    clinicalResolutionRate,
    averageResolutionMinutes,
    averageAccuracyPercent,
  };
}

export async function fetchLeaderboardPayload(userId: string): Promise<LeaderboardPayload> {
  const [rows, user] = await Promise.all([
    fetchRankedLeaderboardRows(),
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        leaderboardOptIn: true,
        leaderboardNameType: true,
        nickname: true,
        name: true,
      },
    }),
  ]);

  if (!user) {
    throw new Error("User not found");
  }

  const preferences: LeaderboardPreferences = {
    leaderboardOptIn: user.leaderboardOptIn,
    leaderboardNameType: user.leaderboardNameType,
    nickname: user.nickname,
  };

  const totalParticipants = rows.length;
  const currentRow = rows.find((r) => r.userId === userId);
  const rank = currentRow ? Number(currentRow.rank) : null;

  const metrics = await fetchPersonalPerformanceMetrics(
    userId,
    user.leaderboardOptIn ? rank : null,
    totalParticipants,
  );

  const top50 = rows.slice(0, TOP_LIMIT).map((row) => toEntry(row, userId));

  let currentEntry: LeaderboardEntry | null = null;
  if (currentRow && user.leaderboardOptIn) {
    currentEntry = toEntry(currentRow, userId);
  } else if (user.leaderboardOptIn && metrics.completedCount > 0) {
    currentEntry = {
      rank: rank ?? totalParticipants + 1,
      displayName: resolveLeaderboardDisplayName({
        userId,
        name: user.name,
        nickname: user.nickname,
        nameType: user.leaderboardNameType,
      }),
      averageScore: metrics.averageScore ?? 0,
      averageAccuracyPercent: metrics.averageAccuracyPercent ?? 0,
      sessionCount: metrics.completedCount,
      isCurrentUser: true,
    };
  }

  return {
    top50,
    currentUser: {
      rank: user.leaderboardOptIn ? rank : null,
      entry: currentEntry,
      preferences,
      metrics: {
        averageScore: metrics.averageScore,
        completedCount: metrics.completedCount,
        rank: user.leaderboardOptIn ? rank : null,
        totalParticipants: metrics.totalParticipants,
        percentileTop: metrics.percentileTop,
        clinicalResolutionRate: metrics.clinicalResolutionRate,
        averageResolutionMinutes: metrics.averageResolutionMinutes,
      },
    },
    generatedAt: new Date().toISOString(),
  };
}

export async function updateLeaderboardPreferences(
  userId: string,
  input: Partial<{
    leaderboardOptIn: boolean;
    leaderboardNameType: LeaderboardNameType;
    nickname: string | null;
  }>,
): Promise<LeaderboardPreferences> {
  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(input.leaderboardOptIn !== undefined
        ? { leaderboardOptIn: input.leaderboardOptIn }
        : {}),
      ...(input.leaderboardNameType !== undefined
        ? { leaderboardNameType: input.leaderboardNameType }
        : {}),
      ...(input.nickname !== undefined ? { nickname: input.nickname?.trim() || null } : {}),
    },
    select: {
      leaderboardOptIn: true,
      leaderboardNameType: true,
      nickname: true,
    },
  });

  return updated;
}
