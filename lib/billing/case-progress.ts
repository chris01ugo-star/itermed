import "server-only";
import { prisma } from "@/lib/prisma";
import {
  displayIdsForStoredCaseId,
  expandLookupIds,
} from "@/lib/billing/case-progress-ids";

export type CasePlayStatus = "todo" | "in_progress" | "completed";

export type CaseProgress = {
  status: CasePlayStatus;
  lastCompletedAt: string | null;
  lastScore: number | null;
  attempts: number;
  lastReportId: string | null;
  resumeSessionId: string | null;
};

export { displayIdsForStoredCaseId, expandLookupIds } from "@/lib/billing/case-progress-ids";

export async function fetchCaseProgressMap(
  userId: string,
  caseIds: string[],
): Promise<Record<string, CaseProgress>> {
  const unique = [...new Set(caseIds.filter(Boolean))];
  const result: Record<string, CaseProgress> = {};
  if (unique.length === 0) return result;

  const lookupIds = expandLookupIds(unique);

  const [reports, liveSessions] = await Promise.all([
    prisma.sessionReport.findMany({
      where: {
        userId,
        caseId: { in: lookupIds },
        status: "COMPLETED",
      },
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
      where: { userId, caseId: { in: lookupIds } },
      select: { id: true, caseId: true, createdAt: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  const reportsByCase = new Map<string, typeof reports>();
  for (const report of reports) {
    const targets = displayIdsForStoredCaseId(report.caseId, unique);
    for (const displayId of targets.length > 0 ? targets : [report.caseId]) {
      const list = reportsByCase.get(displayId) ?? [];
      list.push(report);
      reportsByCase.set(displayId, list);
    }
  }

  const latestSessionByCase = new Map<string, (typeof liveSessions)[number]>();
  for (const session of liveSessions) {
    const targets = displayIdsForStoredCaseId(session.caseId, unique);
    for (const displayId of targets.length > 0 ? targets : [session.caseId]) {
      if (!latestSessionByCase.has(displayId)) {
        latestSessionByCase.set(displayId, session);
      }
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
    if (latest) status = "completed";
    else if (resumeSessionId) status = "in_progress";
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
