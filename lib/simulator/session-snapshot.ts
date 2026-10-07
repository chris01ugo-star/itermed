import { prisma } from "@/lib/prisma";
import { parseChatHistory, type PersistedChatTurn } from "@/lib/simulator/persist-chat-turn";
import {
  parseSessionPrescriptions,
  type SessionPrescription,
} from "@/lib/simulator/prescription-trace";

export type SessionResumeSnapshot = {
  sessionId: string;
  caseId: string;
  chatHistory: PersistedChatTurn[];
  requestedExamIds: string[];
  prescribedMedications: SessionPrescription[];
  completedGoldSteps: string[];
  elapsedMinutes: number;
  targetCondition: string | null;
};

type SessionRow = {
  id: string;
  caseId: string;
  chatHistory: unknown;
  requestedExamIds: string[];
  prescribedMedications: unknown;
  completedGoldSteps: string[];
  elapsedMinutes: number;
  currentTargetCondition: string | null;
};

export function toSessionResumeSnapshot(row: SessionRow): SessionResumeSnapshot {
  return {
    sessionId: row.id,
    caseId: row.caseId,
    chatHistory: parseChatHistory(row.chatHistory),
    requestedExamIds: Array.isArray(row.requestedExamIds) ? row.requestedExamIds : [],
    prescribedMedications: parseSessionPrescriptions(row.prescribedMedications),
    completedGoldSteps: Array.isArray(row.completedGoldSteps) ? row.completedGoldSteps : [],
    elapsedMinutes: row.elapsedMinutes ?? 0,
    targetCondition: row.currentTargetCondition,
  };
}

function liveSessionIdFromReportTrace(raw: unknown): string | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const trace = raw as Record<string, unknown>;
  if (typeof trace.liveSessionId === "string" && trace.liveSessionId.trim()) {
    return trace.liveSessionId.trim();
  }
  const queue = trace.jobQueue;
  if (queue && typeof queue === "object" && !Array.isArray(queue)) {
    const id = (queue as Record<string, unknown>).liveSessionId;
    if (typeof id === "string" && id.trim()) return id.trim();
  }
  return null;
}

/** Sessions already sent to evaluation or dismissed must not be resumed. */
export async function closedLiveSessionIds(params: {
  userId: string;
  caseIds: string[];
}): Promise<Set<string>> {
  if (params.caseIds.length === 0) return new Set();
  const reports = await prisma.sessionReport.findMany({
    where: { userId: params.userId, caseId: { in: params.caseIds } },
    select: { rawTrace: true },
    orderBy: { createdAt: "desc" },
    take: 40,
  });
  const closed = new Set<string>();
  for (const report of reports) {
    const id = liveSessionIdFromReportTrace(report.rawTrace);
    if (id) closed.add(id);
  }
  return closed;
}

export function sessionHasProgress(snapshot: SessionResumeSnapshot): boolean {
  return (
    snapshot.chatHistory.length > 0 ||
    snapshot.requestedExamIds.length > 0 ||
    snapshot.prescribedMedications.length > 0 ||
    snapshot.completedGoldSteps.length > 0 ||
    snapshot.elapsedMinutes > 0
  );
}
