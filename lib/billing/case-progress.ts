import "server-only";
import { prisma } from "@/lib/prisma";
import { completedPerformanceSessionWhere } from "@/lib/session-report-performance";

export type CasePlayStatus = "todo" | "in_progress" | "completed";

export type CaseProgress = {
  status: CasePlayStatus;
  lastCompletedAt: string | null;
  lastScore: number | null;
  attempts: number;
  lastReportId: string | null;
  resumeSessionId: string | null;
};

export async function fetchCaseProgressMap(
  userId: string,
  caseIds: string[],
): Promise<Record<string, CaseProgress>> {
  const unique = [...new Set(caseIds.filter(Boolean))];
  const result: Record<string, CaseProgress> = {};
  if (unique.length === 0) return result;

  const [reports, liveSessions] = await Promise.all([
    prisma.sessionReport.findMany({
      where: completedPerformanceSessionWhere({
        userId,
        caseId: { in: unique },
      }),
      orderBy: { completedAt: "desc" },
      select: {
        id: true,
        caseId: true,
        totalScore: true,
        completedAt: true,
        createdAt: true,
      },
    }),
    prisma.caseSession.findMany({
      where: { userId, caseId: { in: unique } },
      select: { id: true, caseId: true, createdAt: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  const reportsByCase = new Map<string, typeof reports>();
  for (const report of reports) {
    const list = reportsByCase.get(report.caseId) ?? [];
    list.push(report);
    reportsByCase.set(report.caseId, list);
  }

  const latestSessionByCase = new Map<string, (typeof liveSessions)[number]>();
  for (const session of liveSessions) {
    if (!latestSessionByCase.has(session.caseId)) {
      latestSessionByCase.set(session.caseId, session);
    }
  }

  for (const caseId of unique) {
    const caseReports = reportsByCase.get(caseId) ?? [];
    const latest = caseReports[0] ?? null;
    const latestSession = latestSessionByCase.get(caseId) ?? null;
    const hasReportAfterSession =
      latestSession &&
      caseReports.some((report) => report.createdAt >= latestSession.createdAt);
    const resumeSessionId =
      latestSession && !hasReportAfterSession ? latestSession.id : null;
    let status: CasePlayStatus = "todo";
    if (resumeSessionId) status = "in_progress";
    else if (latest) status = "completed";
    result[caseId] = {
      status,
      lastCompletedAt: latest?.completedAt?.toISOString() ?? latest?.createdAt.toISOString() ?? null,
      lastScore: latest ? Math.round(latest.totalScore) : null,
      attempts: caseReports.length,
      lastReportId: latest?.id ?? null,
      resumeSessionId,
    };
  }

  return result;
}
