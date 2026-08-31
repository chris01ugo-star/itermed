import { after } from "next/server";
import { z } from "zod";
import { authorizeSimulationAction } from "@/lib/access";
import { getSessionUserId, unauthorizedJson } from "@/lib/api-session";
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
import {
  ensureRegisteredCaseInDb,
  findClinicalCaseForSimulation,
} from "@/lib/cases/ensure-registered-case";
import { normalizeCaseLookupKey } from "@/lib/data/cases/registry";

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
        id: z.string().default(""),
        name: z.string().default(""),
        cost: z.coerce.number().finite().default(0),
        timeMinutes: z.coerce.number().finite().default(0),
      }),
    )
    .default([]),
  reportText: z.string().default(""),
  caseContext: z.string().optional(),
  finalDiagnosis: z.string().optional(),
  requestedExamIds: z.array(z.string()).default([]),
  executedActionIds: z.array(z.string()).default([]),
  helpRequested: z.boolean().optional(),
  helpRequestCount: z.coerce.number().int().min(0).max(500).optional(),
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
    const userId = await getSessionUserId();
    if (!userId) return unauthorizedJson();

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

    const {
      caseId: rawCaseId,
      sessionId: rawSessionId,
      chatHistory,
      exams,
      reportText,
      caseContext,
      finalDiagnosis,
      requestedExamIds,
      executedActionIds,
      helpRequested,
      helpRequestCount,
    } = parsed.data;
    const caseId = normalizeCaseLookupKey(rawCaseId);
    const log = routeLogger.child({ caseId });

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

    let liveSessionId: string | undefined;
    const access = await authorizeSimulationAction({
      userId,
      sessionId: rawSessionId,
      caseId,
    });
    if (!access.ok) {
      return jsonResponse({ error: access.error, code: access.code }, access.status);
    }
    liveSessionId = access.liveSessionId;

    if (!liveSessionId) {
      const usedToday = await countSimulationsStartedToday(userId);
      const simGate = assertCanStartSimulation(billingProfile, { usedToday });
      if (!simGate.allowed) {
        return gateToResponse(simGate);
      }
    }

    // Materialize registry cases so SessionReport.caseId FK succeeds.
    // Persist the *canonical* ClinicalCase.id (e.g. CARDIO-001), not the
    // lowercased lookup key — otherwise Postgres FK fails with P2003 and the
    // client only sees "An unexpected error occurred."
    const materialized = await ensureRegisteredCaseInDb(caseId, userId);
    const persistCaseId =
      materialized?.id ??
      (await findClinicalCaseForSimulation(caseId))?.id ??
      null;
    if (!persistCaseId) {
      throw new ValidationError("Caso clinico non disponibile per il report.");
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
      caseId: persistCaseId,
      liveSessionId,
      evaluationChatHistory,
      exams,
      normalizedReportText,
      caseContext: sanitizedCaseContext,
      finalDiagnosis: sanitizedFinalDiagnosis,
      requestedExamIds,
      executedActionIds,
      helpRequested,
      helpRequestCount,
    };

    const report = await prisma.sessionReport.create({
      data: {
        userId,
        caseId: persistCaseId,
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
          requestedExamIds,
          executedActionIds,
          helpRequested,
          helpRequestCount,
        }),
      },
      select: { id: true },
    });

    jobInput.reportId = report.id;

    log.info("Simulation report queued", {
      userId,
      reportId: report.id,
      persistCaseId,
    });

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
