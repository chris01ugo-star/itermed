import { userCanPlayCase } from "@/lib/access";
import { createLogger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { evaluationService } from "@/lib/services/evaluation-service";
import type { AnalyticalEvaluation, EvaluationResult } from "@/lib/services/evaluation-service";
import { ragService } from "@/lib/services/rag-service";
import { getExamValuesCatalog } from "@/lib/exam-values-service";
import {
  resolveExamBudgetEuro,
  type DimensionScores,
} from "@/lib/services/evaluation-scoring";
import {
  applyKillerSwitch,
  computeFinalTrentesimiWithKillerSwitch,
  detectFatalErrors,
} from "@/lib/services/evaluation-killer-switch";
import type { FatalError } from "@/lib/services/evaluation-report-types";
import {
  buildSessionReportData,
  type ClinicalCaseSnapshot,
} from "@/lib/services/simulation-report-data";
import type { ChatMessage, ExamPayload } from "@/lib/services/evaluation-service";
import { fetchSessionMilestones } from "@/lib/simulator/milestone-tracker";
import { parseGoldStandardPath } from "@/lib/cases/simulation-time";

export type SimulationReportJobInput = {
  reportId: string;
  userId: string;
  caseId: string;
  /** Live CaseSession id for milestone-aware evaluation. */
  liveSessionId?: string;
  evaluationChatHistory: ChatMessage[];
  exams: ExamPayload[];
  normalizedReportText: string;
  caseContext?: string;
  finalDiagnosis?: string;
};

/** Clinical fail ceiling on the trentesimi scale (&lt; 18/30). */
const KILLER_SWITCH_CAP = 17.9;

/**
 * Narrows EvaluationResult to the analytical checklist shape expected by detectFatalErrors.
 * Graceful fallbacks for partial / missing arrays from a soft AI response.
 */
function toAnalyticalSnapshot(evaluation: EvaluationResult): AnalyticalEvaluation {
  return {
    criticalActions: Array.isArray(evaluation.criticalActions) ? evaluation.criticalActions : [],
    inappropriateActions: Array.isArray(evaluation.inappropriateActions)
      ? evaluation.inappropriateActions
      : [],
    empathyChecklist: Array.isArray(evaluation.empathyChecklist)
      ? evaluation.empathyChecklist
      : [],
    feedback: evaluation.feedback,
    evidence: evaluation.evidence ?? { legalSources: [], protocolSources: [] },
    legalInstrumentReviews: Array.isArray(evaluation.legalInstrumentReviews)
      ? evaluation.legalInstrumentReviews
      : [],
    legalProtectionStatus: evaluation.legalProtectionStatus,
    clinicalDeltaTable: Array.isArray(evaluation.clinicalDeltaTable)
      ? evaluation.clinicalDeltaTable
      : [],
    economicAnalysis: evaluation.economicAnalysis,
    coachingFeedback: evaluation.coachingFeedback,
    fatalErrors: Array.isArray(evaluation.fatalErrors) ? evaluation.fatalErrors : [],
  };
}

function sanitizeDimensionScores(
  scores: EvaluationResult["scores"] | null | undefined,
): DimensionScores {
  const clamp = (n: unknown): number => {
    const value = typeof n === "number" ? n : Number(n);
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(100, value));
  };
  return {
    clinical: clamp(scores?.clinical),
    legal: clamp(scores?.legal),
    exams: clamp(scores?.exams),
    economy: clamp(scores?.economy),
    empathy: clamp(scores?.empathy),
  };
}

/**
 * Applies Killer-Switch on the 0–30 trentesimi scale.
 * Guarantees finalTotal ≤ 17.9 whenever any fatal error is present.
 */
function applyKillerSwitchToEvaluation(evaluation: EvaluationResult): {
  fatalErrors: FatalError[];
  rawTotalTrentesimi: number;
  finalTotalTrentesimi: number;
  killerSwitchApplied: boolean;
  scoresForPersist: DimensionScores;
} {
  const analytical = toAnalyticalSnapshot(evaluation);
  let fatalErrors: FatalError[] = [];
  try {
    fatalErrors = detectFatalErrors(analytical);
  } catch {
    // Never abort the job on detector failure — treat as no fatal errors.
    fatalErrors = [];
  }

  const safeScores = sanitizeDimensionScores(evaluation.scores);
  const { rawTotal, finalTotal, killerSwitchApplied, scoresForPersist } =
    computeFinalTrentesimiWithKillerSwitch(safeScores, fatalErrors);

  // Hard ceiling via applyKillerSwitch — never exceeds 17.9/30 when fatal errors exist.
  const cappedFinal = applyKillerSwitch(finalTotal, fatalErrors);

  return {
    fatalErrors,
    rawTotalTrentesimi: rawTotal,
    finalTotalTrentesimi: cappedFinal,
    // Cap-only: applied whenever fatals exist (partials stay authentic in scoresForPersist).
    killerSwitchApplied: killerSwitchApplied || cappedFinal < rawTotal,
    scoresForPersist,
  };
}

export async function processSimulationReportJob(input: SimulationReportJobInput): Promise<void> {
  const log = createLogger("simulation-report-worker").child({
    reportId: input.reportId,
    caseId: input.caseId,
    userId: input.userId,
  });
  const jobStartedAt = Date.now();

  try {
    await prisma.sessionReport.update({
      where: { id: input.reportId },
      data: {
        status: "PROCESSING",
        progress: 20,
        progressMessage: "Preparazione analisi caso...",
      },
    });

    const allowed = await userCanPlayCase(input.userId, input.caseId);
    if (!allowed) {
      throw new Error("Forbidden");
    }

    const prefetchStartedAt = Date.now();
    // Load case first so RAG can apply a strict specialtyId filter.
    const clinicalCase = await prisma.clinicalCase.findUnique({
      where: { id: input.caseId },
      select: {
        difficulty: true,
        medicalSpecialtyId: true,
        specialty: true,
        baselineExamFindings: true,
        goldStandardPath: true,
        medicalSpecialty: { select: { id: true, name: true } },
      },
    });

    const specialtyId =
      clinicalCase?.medicalSpecialtyId ?? clinicalCase?.medicalSpecialty?.id ?? undefined;
    const specialtyName =
      clinicalCase?.medicalSpecialty?.name ?? clinicalCase?.specialty ?? undefined;

    const [guidelines, examCatalog] = await Promise.all([
      ragService.getRelevantGuidelines({
        finalDiagnosis: input.finalDiagnosis,
        caseContext: input.caseContext,
        reportText: input.normalizedReportText,
        specialtyId,
        specialtyName,
      }),
      getExamValuesCatalog(),
    ]);
    const prefetchDurationMs = Date.now() - prefetchStartedAt;

    await prisma.sessionReport.update({
      where: { id: input.reportId },
      data: {
        progress: 40,
        progressMessage: "Confronto con linee guida e tutele legali...",
      },
    });

    const caseDifficulty = clinicalCase?.difficulty;
    const examBudgetEuro = resolveExamBudgetEuro(
      caseDifficulty,
      clinicalCase?.baselineExamFindings,
    );

    log.info("Parallel prefetch completed", {
      prefetchDurationMs,
      legalSource: guidelines.legal.source,
      protocolSource: guidelines.protocol.source,
      specialtyId: specialtyId ?? null,
      specialtyName: specialtyName ?? null,
      difficulty: caseDifficulty,
      examBudgetEuro,
    });

    await prisma.sessionReport.update({
      where: { id: input.reportId },
      data: {
        progress: 70,
        progressMessage: "Generazione report...",
      },
    });

    const evaluationStartedAt = Date.now();
    const sessionMilestones = input.liveSessionId
      ? await fetchSessionMilestones(input.liveSessionId)
      : [];

    const goldStandardPath = parseGoldStandardPath(clinicalCase?.goldStandardPath);

    const evaluation = await evaluationService.evaluateSimulation({
      chatHistory: Array.isArray(input.evaluationChatHistory)
        ? input.evaluationChatHistory
        : [],
      exams: Array.isArray(input.exams) ? input.exams : [],
      reportText: input.normalizedReportText ?? "",
      caseContext: input.caseContext,
      finalDiagnosis: input.finalDiagnosis,
      guidelines,
      difficulty: caseDifficulty,
      specialty: specialtyName,
      examBudgetEuro,
      baselineExamFindings: clinicalCase?.baselineExamFindings ?? {},
      examCatalog: examCatalog ?? {},
      goldStandardPath: goldStandardPath.length > 0 ? goldStandardPath : undefined,
      sessionMilestones: Array.isArray(sessionMilestones) ? sessionMilestones : [],
    });
    const evaluationDurationMs = Date.now() - evaluationStartedAt;

    // --- Killer-Switch (deterministic, post-AI) ---
    const {
      fatalErrors,
      rawTotalTrentesimi,
      finalTotalTrentesimi,
      killerSwitchApplied,
      scoresForPersist,
    } = applyKillerSwitchToEvaluation(evaluation);

    const evaluationForPersist: EvaluationResult = {
      ...evaluation,
      scores: scoresForPersist,
    };

    const totalScore = finalTotalTrentesimi;
    const completedAt = new Date();

    const liveSession = input.liveSessionId
      ? await prisma.caseSession.findUnique({
          where: { id: input.liveSessionId },
          select: { elapsedMinutes: true, createdAt: true },
        })
      : null;

    const simulationElapsedMinutes =
      liveSession && liveSession.elapsedMinutes > 0
        ? liveSession.elapsedMinutes
        : liveSession
          ? Math.max(
              1,
              Math.round((completedAt.getTime() - liveSession.createdAt.getTime()) / 60_000),
            )
          : null;

    log.info("Killer-Switch evaluation", {
      fatalErrorCount: fatalErrors.length,
      killerSwitchApplied,
      rawTotalTrentesimi,
      finalTotalTrentesimi,
      cap: KILLER_SWITCH_CAP,
    });

    await prisma.sessionReport.update({
      where: { id: input.reportId },
      data: {
        progress: 90,
        progressMessage: killerSwitchApplied
          ? "Applicazione Killer-Switch clinico..."
          : "Finalizzazione punteggi...",
      },
    });

    const persistStartedAt = Date.now();
    await prisma.sessionReport.update({
      where: { id: input.reportId },
      data: {
        ...buildSessionReportData({
          userId: input.userId,
          caseId: input.caseId,
          clinicalCase: clinicalCase as ClinicalCaseSnapshot,
          evaluationChatHistory: input.evaluationChatHistory,
          exams: input.exams,
          normalizedReportText: input.normalizedReportText,
          evaluation: evaluationForPersist,
          guidelines,
          totalScore,
          completedAt,
          simulationElapsedMinutes,
          fatalErrors,
          killerSwitch: {
            applied: killerSwitchApplied,
            rawTotalTrentesimi,
            finalTotalTrentesimi,
            cap: KILLER_SWITCH_CAP,
          },
        }),
        ...(liveSession ? { startedAt: liveSession.createdAt } : {}),
      },
    });
    const persistDurationMs = Date.now() - persistStartedAt;

    log.info("Simulation report completed", {
      totalScore,
      killerSwitchApplied,
      fatalErrorCount: fatalErrors.length,
      prefetchDurationMs,
      evaluationDurationMs,
      persistDurationMs,
      totalDurationMs: Date.now() - jobStartedAt,
    });
    // Free-trial usage is consumed at POST /api/session/start, not on report completion.
  } catch (error) {
    const detail =
      error instanceof Error
        ? error.message.slice(0, 280)
        : typeof error === "string"
          ? error.slice(0, 280)
          : "errore sconosciuto";

    log.error("Simulation report job failed", {
      error,
      detail,
      durationMs: Date.now() - jobStartedAt,
    });

    await prisma.sessionReport
      .update({
        where: { id: input.reportId },
        data: {
          status: "FAILED",
          progressMessage: "Errore durante la generazione.",
          notes: `Report generation failed: ${detail}`,
        },
      })
      .catch((updateError) => {
        log.error("Failed to mark report as FAILED", { updateError });
      });
  }
}
