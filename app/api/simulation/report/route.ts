import { after } from "next/server";
import { z } from "zod";
import { userCanPlayCase, verifyLiveSessionOwner } from "@/lib/access";
import { getSessionUserId } from "@/lib/api-session";
import { assertCanStartSimulation, gateToResponse } from "@/lib/billing/access-gate";
import { countSimulationsStartedToday } from "@/lib/billing/daily-sim-quota";
import { getUserBillingProfile } from "@/lib/billing/user-billing";
import { toApiErrorResponse, ValidationError } from "@/lib/errors";
import { createLogger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { normalizeReportText, sanitizeChatHistory } from "@/lib/services/evaluation-service";
import {
  sanitizeForExternalAI,
  sanitizeOptionalForExternalAI,
  sanitizeUserMessagesForAI,
} from "@/lib/security/sanitize-for-ai";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import {
  buildJobQueueRawTrace,
  scheduleSimulationReportJob,
} from "@/lib/services/simulation-report-scheduler";

export const runtime = "nodejs";
export const maxDuration = 120;

const SimulationReportBodySchema = z.object({
  caseId: z.string().min(1, "caseId is required"),
  /** Live CaseSession id — used to load SimulationMilestone rows for evaluation. */
  sessionId: z.string().min(1).optional(),
  chatHistory: z
    .array(
      z.object({
        role: z.enum(["system", "user", "assistant"]),
        content: z.string(),
      }),
    )
    .default([]),
  exams: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        cost: z.number(),
        timeMinutes: z.number(),
      }),
    )
    .default([]),
  reportText: z.string().default(""),
  caseContext: z.string().optional(),
  finalDiagnosis: z.string().optional(),
});

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(req: Request) {
  const routeLogger = createLogger("simulation-report");

  try {
    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      throw new ValidationError("Invalid JSON request body.");
    }

    const parsed = SimulationReportBodySchema.safeParse(rawBody);
    if (!parsed.success) {
      const message = parsed.error.issues.map((issue) => issue.message).join("; ");
      throw new ValidationError(message);
    }

    const { caseId, sessionId: liveSessionId, chatHistory, exams, reportText, caseContext, finalDiagnosis } =
      parsed.data;
    const log = routeLogger.child({ caseId });

    const userId = await getSessionUserId();
    if (!userId) {
      return jsonResponse({ error: "Unauthorized", code: "UNAUTHORIZED" }, 401);
    }

    const rateLimited = await enforceRateLimit(req, {
      namespace: "api-simulation-report",
      limit: 3,
      userId,
    });
    if (rateLimited) return rateLimited;

    const billingProfile = await getUserBillingProfile(userId);
    if (!billingProfile) {
      return jsonResponse({ error: "User not found", code: "NOT_FOUND" }, 404);
    }

    const allowed = await userCanPlayCase(userId, caseId);
    if (!allowed) {
      return jsonResponse({ error: "Forbidden", code: "FORBIDDEN" }, 403);
    }

    if (liveSessionId) {
      const owns = await verifyLiveSessionOwner(liveSessionId, userId);
      if (!owns) {
        return jsonResponse({ error: "Forbidden", code: "FORBIDDEN" }, 403);
      }
      // Owned live session already passed the trial gate at /api/session/start.
    } else {
      const usedToday = await countSimulationsStartedToday(userId);
      const simGate = assertCanStartSimulation(billingProfile, { usedToday });
      if (!simGate.allowed) {
        return gateToResponse(simGate);
      }
    }

    const normalizedReportText = normalizeReportText(
      sanitizeForExternalAI(reportText),
    );
    const evaluationChatHistory = sanitizeUserMessagesForAI(sanitizeChatHistory(chatHistory));
    const sanitizedCaseContext = sanitizeOptionalForExternalAI(caseContext);
    const sanitizedFinalDiagnosis = sanitizeOptionalForExternalAI(finalDiagnosis);

    const jobInput = {
      reportId: "" as string,
      userId,
      caseId,
      liveSessionId,
      evaluationChatHistory,
      exams,
      normalizedReportText,
      caseContext: sanitizedCaseContext,
      finalDiagnosis: sanitizedFinalDiagnosis,
    };

    const report = await prisma.sessionReport.create({
      data: {
        userId,
        caseId,
        status: "PENDING",
        progress: 10,
        progressMessage: "Inizializzazione report...",
        clinicalAccuracy: 0,
        legalComplianceGelliBianco: 0,
        prescribingAppropriateness: 0,
        economicSustainability: 0,
        empathy: 0,
        totalScore: 0,
        rawTrace: buildJobQueueRawTrace({
          evaluationChatHistory,
          exams,
          normalizedReportText,
          caseContext: sanitizedCaseContext,
          finalDiagnosis: sanitizedFinalDiagnosis,
          liveSessionId,
        }),
      },
      select: { id: true },
    });

    jobInput.reportId = report.id;

    log.info("Simulation report queued", { userId, reportId: report.id });

    const runJob = () => scheduleSimulationReportJob(jobInput);

    // Primary: Next.js after() keeps work alive after the 202 response in production.
    after(async () => {
      runJob();
    });

    // Dev safety net: schedule immediately on the Node process (idempotent).
    runJob();

    return jsonResponse(
      {
        reportId: report.id,
        sessionId: report.id,
        status: "PENDING",
        progress: 10,
        progressMessage: "Inizializzazione report...",
      },
      202,
    );
  } catch (error) {
    routeLogger.error("Simulation report enqueue failed", { error });
    return toApiErrorResponse(error);
  }
}
