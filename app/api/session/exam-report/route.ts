import { generateObject } from "ai";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { requireUserApi, isUnauthorizedResponse } from "@/lib/api-session";
import { authorizeSimulationAction } from "@/lib/access";
import { asOpenAIStrictSchema } from "@/lib/ai/strict-schema";
import { withOpenAIRetry } from "@/lib/ai/openai-retry";
import { MODEL_GPT_6_LUNA, openAIObjectCall } from "@/lib/ai/models";
import { prisma } from "@/lib/prisma";
import { AI_PROMPT_INJECTION_GUARD } from "@/lib/security/ai-prompt-guards";
import { AI_RATE_LIMITS } from "@/lib/security/ai-rate-limits";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { createLogger } from "@/lib/logger";
import {
  examReportObjectSchema,
  finalizeClinicalExamReport,
  readGeneratedExamReport,
  toStoredExamReport,
  type ClinicalExamReport,
  type StoredExamReport,
} from "@/lib/simulator/exam-report";
import {
  EXAM_REPORT_SYSTEM_PROMPT,
  loadExamReportGroundTruth,
} from "@/lib/simulator/exam-report-server";
import {
  EXAM_CACHE_BASELINE_KEY,
  EXAM_REPORT_CACHE_PROMPT_VERSION,
  buildExamCacheContextKey,
  conservativeExamRepeatCount,
  mergePrescribedDrugLabels,
  type ExamCacheContextKey,
} from "@/lib/simulator/exam-report-cache";

export const runtime = "nodejs";
export const maxDuration = 120;

const log = createLogger("exam-report");

const bodySchema = z.object({
  sessionId: z.string().trim().min(1).optional(),
  caseId: z.string().trim().min(1),
  examId: z.string().trim().min(1).max(120),
  examName: z.string().trim().min(1).max(240),
  examCategory: z.string().trim().max(40).optional(),
  elapsedMinutes: z.number().finite().min(0).max(10_080).optional(),
  deteriorationLevel: z.number().finite().min(0).max(100).optional(),
  repeatCount: z.number().int().min(0).max(50).optional(),
  deteriorationTriggered: z.boolean().optional(),
  prescribedDrugs: z.array(z.string().trim().max(160)).max(40).optional(),
  executedInterventions: z.array(z.string().trim().max(240)).max(80).optional(),
});

const RESERVED_OVERRIDE_KEYS = new Set([
  "vitals",
  "thorax",
  "abdomen",
  "neuro",
  "physicalExam",
  "peripheral",
  "notes",
  "clinicalSigns",
  "advancedExams",
  "allergies",
  "patient",
]);

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function reportStorageKey(examId: string): string {
  return RESERVED_OVERRIDE_KEYS.has(examId) ? `report:${examId}` : examId;
}

function publicReport(report: ClinicalExamReport | StoredExamReport): ClinicalExamReport {
  return {
    title: report.title,
    category: report.category,
    isAbnormal: report.isAbnormal,
    summary: report.summary,
    parameters: report.parameters,
    sections: report.sections,
    formattedText: report.formattedText,
  };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

type SessionExamContext = {
  overrides: Record<string, unknown> | null;
  prescribedDrugs: string[];
  requestedExamIds: string[];
  deteriorationTriggered: boolean;
  /** False when the session row could not be read. Shared baseline is then skipped. */
  loaded: boolean;
};

function drugLabels(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const labels: string[] = [];
  for (const entry of value) {
    if (typeof entry === "string") {
      const label = entry.trim();
      if (label) labels.push(label);
      continue;
    }
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    for (const key of ["commercialName", "activeIngredient", "name", "id"] as const) {
      const raw = record[key];
      if (typeof raw === "string" && raw.trim()) labels.push(raw.trim());
    }
  }
  return labels;
}

function timelineHasDeterioration(value: unknown): boolean {
  if (!Array.isArray(value)) return false;
  return value.some((entry) => {
    if (!entry || typeof entry !== "object") return false;
    return (entry as { category?: unknown }).category === "deterioration";
  });
}

async function readSessionDeterioration(sessionId: string): Promise<boolean> {
  try {
    const row = await prisma.caseSession.findUnique({
      where: { id: sessionId },
      select: { stressTimeline: true },
    });
    return timelineHasDeterioration(row?.stressTimeline);
  } catch (error) {
    log.warn("stressTimeline read skipped for exam cache", {
      error: error instanceof Error ? error.message : String(error),
      sessionId,
    });
    return false;
  }
}

async function loadSessionExamContext(sessionId: string): Promise<SessionExamContext> {
  try {
    const row = await prisma.caseSession.findUnique({
      where: { id: sessionId },
      select: {
        examOverrides: true,
        prescribedMedications: true,
        requestedExamIds: true,
      },
    });
    const requestedExamIds = Array.isArray(row?.requestedExamIds)
      ? row.requestedExamIds.filter((id): id is string => typeof id === "string")
      : [];
    return {
      overrides: asRecord(row?.examOverrides),
      prescribedDrugs: drugLabels(row?.prescribedMedications),
      requestedExamIds,
      deteriorationTriggered: await readSessionDeterioration(sessionId),
      loaded: true,
    };
  } catch (error) {
    log.warn("examOverrides read failed; continuing without session cache", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      overrides: null,
      prescribedDrugs: [],
      requestedExamIds: [],
      deteriorationTriggered: false,
      loaded: false,
    };
  }
}

async function readSharedBaselineReport(
  caseId: string,
  examId: string,
): Promise<StoredExamReport | null> {
  try {
    const row = await prisma.caseExamReportCache.findUnique({
      where: {
        caseId_examId_contextKey_promptVersion: {
          caseId,
          examId,
          contextKey: EXAM_CACHE_BASELINE_KEY,
          promptVersion: EXAM_REPORT_CACHE_PROMPT_VERSION,
        },
      },
      select: { reportJson: true },
    });
    return readGeneratedExamReport(row?.reportJson);
  } catch (error) {
    log.warn("shared exam cache read skipped", {
      error: error instanceof Error ? error.message : String(error),
      caseId,
      examId,
    });
    return null;
  }
}

async function writeSharedBaselineReport(
  caseId: string,
  examId: string,
  report: StoredExamReport,
): Promise<void> {
  try {
    await prisma.caseExamReportCache.upsert({
      where: {
        caseId_examId_contextKey_promptVersion: {
          caseId,
          examId,
          contextKey: EXAM_CACHE_BASELINE_KEY,
          promptVersion: EXAM_REPORT_CACHE_PROMPT_VERSION,
        },
      },
      create: {
        caseId,
        examId,
        contextKey: EXAM_CACHE_BASELINE_KEY,
        promptVersion: EXAM_REPORT_CACHE_PROMPT_VERSION,
        reportJson: report as Prisma.InputJsonValue,
      },
      update: {
        reportJson: report as Prisma.InputJsonValue,
      },
    });
  } catch (error) {
    log.warn("shared exam cache write skipped", {
      error: error instanceof Error ? error.message : String(error),
      caseId,
      examId,
    });
  }
}

async function persistGeneratedReport(
  sessionId: string,
  examId: string,
  report: StoredExamReport,
): Promise<StoredExamReport> {
  const key = reportStorageKey(examId);
  return prisma.$transaction(async (tx) => {
    const row = await tx.caseSession.findUnique({
      where: { id: sessionId },
      select: { examOverrides: true },
    });
    if (!row) return report;
    const current = asRecord(row.examOverrides) ?? {};
    const existing = readGeneratedExamReport(current[key]);
    if (existing) return existing;
    const next = { ...current, [key]: report };
    await tx.caseSession.update({
      where: { id: sessionId },
      data: { examOverrides: next as Prisma.InputJsonValue },
    });
    return report;
  });
}

export async function POST(req: Request) {
  const auth = await requireUserApi();
  if (isUnauthorizedResponse(auth)) return auth;

  const rateLimited = await enforceRateLimit(req, {
    namespace: "api-session-exam-report",
    limit: AI_RATE_LIMITS.examReport,
    userId: auth.id,
  });
  if (rateLimited) return rateLimited;

  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await req.json());
  } catch {
    return json({ error: "Invalid body", code: "INVALID_BODY" }, 400);
  }

  const access = await authorizeSimulationAction({
    userId: auth.id,
    sessionId: parsed.sessionId,
    caseId: parsed.caseId,
  });
  if (!access.ok) {
    return json({ error: access.error, code: access.code }, access.status);
  }

  const liveSessionId = access.liveSessionId;
  const caseId = access.caseId ?? parsed.caseId;
  const storageKey = reportStorageKey(parsed.examId);

  const session = liveSessionId
    ? await loadSessionExamContext(liveSessionId)
    : {
        overrides: null,
        prescribedDrugs: [] as string[],
        requestedExamIds: [] as string[],
        deteriorationTriggered: false,
        loaded: true,
      };
  const sessionOverrides = session.overrides;

  if (sessionOverrides) {
    const cached = readGeneratedExamReport(sessionOverrides[storageKey]);
    if (cached) {
      return json({ report: publicReport(cached), cached: true });
    }
  }

  const contextKey: ExamCacheContextKey | null = session.loaded
    ? buildExamCacheContextKey({
        repeatCount: conservativeExamRepeatCount({
          clientRepeatCount: parsed.repeatCount,
          sessionRequestedExamIds: session.requestedExamIds,
          examId: parsed.examId,
        }),
        deteriorationTriggered:
          session.deteriorationTriggered || parsed.deteriorationTriggered === true,
        prescribedDrugs: mergePrescribedDrugLabels(session.prescribedDrugs, parsed.prescribedDrugs),
        executedInterventions: parsed.executedInterventions ?? [],
      })
    : null;

  if (contextKey === EXAM_CACHE_BASELINE_KEY) {
    const shared = await readSharedBaselineReport(caseId, parsed.examId);
    if (shared) {
      log.info("exam report cache", {
        examCache: "shared_hit",
        caseId,
        examId: parsed.examId,
      });
      if (liveSessionId) {
        try {
          await persistGeneratedReport(liveSessionId, parsed.examId, shared);
        } catch (error) {
          log.warn("shared exam report session copy skipped", {
            error: error instanceof Error ? error.message : String(error),
            sessionId: liveSessionId,
            examId: parsed.examId,
          });
        }
      }
      return json({ report: publicReport(shared), cached: true });
    }
  }

  let groundTruth: Awaited<ReturnType<typeof loadExamReportGroundTruth>>;
  try {
    groundTruth = await loadExamReportGroundTruth({
      caseId,
      examId: parsed.examId,
      examName: parsed.examName,
      examCategoryHint: parsed.examCategory,
      elapsedMinutes: parsed.elapsedMinutes,
      deteriorationLevel: parsed.deteriorationLevel,
      sessionOverrides,
    });
  } catch (error) {
    log.error("ground truth load failed", {
      error: error instanceof Error ? error.message : String(error),
      caseId,
      examId: parsed.examId,
    });
    return json({ error: "Impossibile caricare il caso", code: "CASE_CONTEXT_FAILED" }, 500);
  }

  log.info("exam report cache", {
    examCache: "miss",
    caseId,
    examId: parsed.examId,
    contextKey,
  });

  let generated: ClinicalExamReport;
  try {
    const { object } = await withOpenAIRetry(() =>
      generateObject({
        ...openAIObjectCall(MODEL_GPT_6_LUNA),
        system: `${AI_PROMPT_INJECTION_GUARD}\n\n${EXAM_REPORT_SYSTEM_PROMPT}`,
        schema: asOpenAIStrictSchema(examReportObjectSchema),
        maxTokens: 4000,
        prompt: groundTruth.prompt,
      }),
    );
    generated = finalizeClinicalExamReport(object, {
      examId: parsed.examId,
      examName: parsed.examName,
      category: groundTruth.category,
    });
  } catch (error) {
    log.error("exam report generation failed", {
      error: error instanceof Error ? error.message : String(error),
      caseId,
      examId: parsed.examId,
    });
    return json({ error: "Refertazione non disponibile", code: "EXAM_REPORT_FAILED" }, 502);
  }

  let stored = toStoredExamReport(generated, parsed.examId);
  if (liveSessionId) {
    try {
      stored = await persistGeneratedReport(liveSessionId, parsed.examId, stored);
    } catch (error) {
      log.warn("exam report persist skipped", {
        error: error instanceof Error ? error.message : String(error),
        sessionId: liveSessionId,
        examId: parsed.examId,
      });
    }
  }

  if (contextKey === EXAM_CACHE_BASELINE_KEY) {
    await writeSharedBaselineReport(caseId, parsed.examId, stored);
  }

  return json({ report: publicReport(stored), cached: false });
}
