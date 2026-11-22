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

async function loadSessionOverrides(
  sessionId: string,
): Promise<Record<string, unknown> | null> {
  try {
    const row = await prisma.caseSession.findUnique({
      where: { id: sessionId },
      select: { examOverrides: true },
    });
    return asRecord(row?.examOverrides);
  } catch (error) {
    log.warn("examOverrides read failed; continuing without session cache", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
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

  let sessionOverrides: Record<string, unknown> | null = null;
  if (liveSessionId) {
    sessionOverrides = await loadSessionOverrides(liveSessionId);
    const cached = readGeneratedExamReport(sessionOverrides?.[storageKey]);
    if (cached) {
      return json({ report: publicReport(cached), cached: true });
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

  return json({ report: publicReport(stored), cached: false });
}
