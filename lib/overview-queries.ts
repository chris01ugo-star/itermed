import type { CaseDifficulty } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { config, isUsableDatabase } from "@/lib/config";
import { displaySpecialtyName } from "@/lib/dashboard-case-utils";
import { createLogger } from "@/lib/logger";
import { normalizeTrentesimiScore } from "@/lib/scoring/trentesimi";
import { completedPerformanceSessionWhere } from "@/lib/session-report-performance";

const overviewLogger = createLogger("overview-queries");

export const OVERVIEW_RADAR_METRICS = [
  { metric: "Accuratezza Clinica", key: "clinicalAccuracy" as const },
  { metric: "Tutela Legale", key: "legalComplianceGelliBianco" as const },
  { metric: "Appropriatezza", key: "prescribingAppropriateness" as const },
  { metric: "Sostenibilità", key: "economicSustainability" as const },
  { metric: "Empatia", key: "empathy" as const },
];

export const FOCUS_LABELS: Record<(typeof OVERVIEW_RADAR_METRICS)[number]["key"], string> = {
  clinicalAccuracy: "Accuratezza Clinica",
  legalComplianceGelliBianco: "Tutela Medico-Legale",
  prescribingAppropriateness: "Appropriatezza Prescrittiva",
  economicSustainability: "Sostenibilità Economica",
  empathy: "Empatia e Comunicazione",
};

export type OverviewRadarPoint = {
  metric: string;
  score: number;
};

export type RecentSessionRow = {
  sessionId: string;
  caseId: string;
  title: string;
  specialty: string;
  difficulty: CaseDifficulty;
  completedLabel: string;
  score: number;
};

export type UserOverviewData = {
  completedCount: number;
  iterMedScore: number | null;
  casesThisWeek: number;
  streakDays: number;
  focusLabel: string;
  focusShort: string;
  radarData: OverviewRadarPoint[];
  recentSessions: RecentSessionRow[];
};

function formatItalianLongDate(date: Date): string {
  return date.toLocaleDateString("it-IT", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function computeStreakDays(sessionDates: Date[], now: Date): number {
  const dayKey = (d: Date) => d.toISOString().slice(0, 10);
  const daysWithCases = new Set(sessionDates.map(dayKey));

  let streakDays = 0;
  for (let offset = 0; offset < 30; offset++) {
    const d = new Date(now);
    d.setDate(now.getDate() - offset);
    if (daysWithCases.has(dayKey(d))) {
      streakDays += 1;
    } else if (offset > 0) {
      break;
    }
  }
  return streakDays;
}

/** Safe empty overview for offline / Prisma-unavailable dashboards. */
export function emptyUserOverviewData(): UserOverviewData {
  return {
    completedCount: 0,
    iterMedScore: null,
    casesThisWeek: 0,
    streakDays: 0,
    focusLabel: "Competenze cliniche",
    focusShort: "Competenze",
    radarData: OVERVIEW_RADAR_METRICS.map(({ metric }) => ({ metric, score: 0 })),
    recentSessions: [],
  };
}

/** Loads completed SessionReport aggregates and recent history for the overview dashboard. */
export async function fetchUserOverviewData(userId: string): Promise<UserOverviewData> {
  if (!userId || !isUsableDatabase(config.DATABASE_URL)) {
    return emptyUserOverviewData();
  }

  try {
    return await Promise.race([
      loadUserOverviewData(userId),
      new Promise<UserOverviewData>((_, reject) => {
        setTimeout(
          () => reject(new Error("overview query timed out after 4000ms")),
          4_000,
        );
      }),
    ]);
  } catch (error) {
    overviewLogger.warn("overview query failed; returning empty dashboard data (offline / DB down)", {
      userId,
      errorName: error instanceof Error ? error.name : undefined,
      errorMessage: error instanceof Error ? error.message.slice(0, 240) : String(error).slice(0, 240),
    });
    return emptyUserOverviewData();
  }
}

async function loadUserOverviewData(userId: string): Promise<UserOverviewData> {
  const now = new Date();

  const performanceWhere = completedPerformanceSessionWhere({ userId });

  const [completedSessions, scoreAverages] = await Promise.all([
    prisma.sessionReport.findMany({
      where: performanceWhere,
      orderBy: [{ completedAt: "desc" }, { createdAt: "desc" }],
      include: { case: { include: { medicalSpecialty: true } } },
      take: 50,
    }),
    prisma.sessionReport.aggregate({
      where: performanceWhere,
      _avg: {
        clinicalAccuracy: true,
        legalComplianceGelliBianco: true,
        prescribingAppropriateness: true,
        economicSustainability: true,
        empathy: true,
        totalScore: true,
      },
    }),
  ]);

  const radarData: OverviewRadarPoint[] = OVERVIEW_RADAR_METRICS.map(({ metric, key }) => ({
    metric,
    score: Math.round(scoreAverages._avg[key] ?? 0),
  }));

  const focusDimension = OVERVIEW_RADAR_METRICS.reduce<
    (typeof OVERVIEW_RADAR_METRICS)[number] | null
  >((lowest, current) => {
    const currentScore = scoreAverages._avg[current.key] ?? 0;
    if (!lowest) return current;
    const lowestScore = scoreAverages._avg[lowest.key] ?? 0;
    return currentScore < lowestScore ? current : lowest;
  }, null);

  const focusLabel = focusDimension ? FOCUS_LABELS[focusDimension.key] : "Competenze cliniche";
  const focusShort =
    focusDimension?.key === "economicSustainability" ? "Economia" : focusLabel.split(" ")[0];

  const startOfWeek = new Date(now);
  startOfWeek.setHours(0, 0, 0, 0);
  startOfWeek.setDate(startOfWeek.getDate() - 6);

  const sessionsThisWeek = completedSessions.filter(
    (s) => (s.completedAt ?? s.createdAt) >= startOfWeek,
  );

  const iterMedScore =
    completedSessions.length > 0
      ? (() => {
          const scores = completedSessions
            .map((s) => normalizeTrentesimiScore(s.totalScore))
            .filter((s): s is number => s != null);
          if (scores.length === 0) return normalizeTrentesimiScore(scoreAverages._avg.totalScore);
          return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
        })()
      : null;

  const streakDays = computeStreakDays(
    completedSessions.map((s) => s.completedAt ?? s.createdAt),
    now,
  );

  const recentSessions: RecentSessionRow[] = completedSessions.slice(0, 8).map((s) => {
    const completedAt = s.completedAt ?? s.createdAt;
    return {
      sessionId: s.id,
      caseId: s.caseId,
      title: s.case.title,
      specialty:
        s.medicalSpecialtyNameSnapshot ??
        displaySpecialtyName({
          specialty: s.case.specialty,
          medicalSpecialty: s.case.medicalSpecialty,
        }),
      difficulty: s.difficultySnapshot ?? s.case.difficulty,
      completedLabel: formatItalianLongDate(completedAt),
      score: Math.round(normalizeTrentesimiScore(s.totalScore) ?? 0),
    };
  });

  return {
    completedCount: completedSessions.length,
    iterMedScore,
    casesThisWeek: sessionsThisWeek.length,
    streakDays,
    focusLabel,
    focusShort,
    radarData,
    recentSessions,
  };
}
