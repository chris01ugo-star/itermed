import { prisma } from "@/lib/prisma";
import { getSessionUserId, unauthorizedJson } from "@/lib/api-session";
import { knowledgeBaseIdCandidates } from "@/lib/data/cases/registry-store";
import {
  closedLiveSessionIds,
  sessionHasProgress,
  toSessionResumeSnapshot,
} from "@/lib/simulator/session-snapshot";

export const runtime = "nodejs";

const sessionSelect = {
  id: true,
  caseId: true,
  chatHistory: true,
  requestedExamIds: true,
  prescribedMedications: true,
  completedGoldSteps: true,
  elapsedMinutes: true,
  currentTargetCondition: true,
  disclaimerAcceptedAt: true,
  disclaimerVersion: true,
} as const;

/**
 * Latest in-progress CaseSession for this user and case.
 * Sessions already submitted (report / dismiss) are skipped.
 */
export async function GET(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return unauthorizedJson();

  const caseId = new URL(req.url).searchParams.get("caseId")?.trim() ?? "";
  if (!caseId) {
    return new Response(JSON.stringify({ error: "caseId required", code: "CASE_REQUIRED" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const caseIds = [...new Set([caseId, ...knowledgeBaseIdCandidates(caseId)])];
  const sessions = await prisma.caseSession.findMany({
    where: { userId, caseId: { in: caseIds } },
    orderBy: { createdAt: "desc" },
    take: 8,
    select: sessionSelect,
  });

  const closed = await closedLiveSessionIds({ userId, caseIds });
  const open = sessions
    .filter((row) => !closed.has(row.id))
    .map((row) => toSessionResumeSnapshot(row));
  const snapshot = open.find(sessionHasProgress) ?? open[0] ?? null;

  return new Response(JSON.stringify(snapshot ?? { sessionId: null }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
