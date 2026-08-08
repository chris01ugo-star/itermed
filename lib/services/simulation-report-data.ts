import type { CaseDifficulty, Prisma } from "@prisma/client";
import type { RelevantGuidelines } from "@/lib/services/rag-service";
import type { EvaluationResult } from "@/lib/services/evaluation-service";
import type { LegalAuditResult } from "@/lib/services/legal-audit-service";
import type { EconomicAuditResult } from "@/lib/services/economic-audit-service";
import type {
  ClinicalDeltaRow,
  CoachingFeedback,
  EconomicAnalysis,
  FatalError,
  LegalProtectionStatus,
} from "@/lib/services/evaluation-report-types";
import type { ChatMessage, ExamPayload } from "@/lib/services/evaluation-service";
import type { EmpathyBehavioralBreakdown, ScoreBreakdown } from "@/lib/services/evaluation-scoring";

export type ClinicalCaseSnapshot = {
  difficulty: CaseDifficulty;
  medicalSpecialtyId: string | null;
  specialty: string | null;
  medicalSpecialty: { id: string; name: string } | null;
  baselineExamFindings?: unknown;
} | null;

/** Killer-Switch telemetry persisted inside SessionReport.rawTrace (Json). */
export type KillerSwitchTrace = {
  applied: boolean;
  rawTotalTrentesimi: number;
  finalTotalTrentesimi: number;
  cap: number;
};

export function buildSessionReportData(params: {
  userId: string;
  caseId: string;
  clinicalCase: ClinicalCaseSnapshot;
  evaluationChatHistory: ChatMessage[];
  exams: ExamPayload[];
  normalizedReportText: string;
  evaluation: EvaluationResult;
  guidelines: RelevantGuidelines;
  /** Final grade on 0–30 trentesimi scale (Killer-Switch may cap at 17.9). */
  totalScore: number;
  completedAt: Date;
  /** Wall / clinical simulation minutes (from CaseSession when available). */
  simulationElapsedMinutes?: number | null;
  /** Deterministic fatal errors detected post-evaluation (always persisted). */
  fatalErrors?: FatalError[];
  killerSwitch?: KillerSwitchTrace;
  /** Dedicated LLM legal audit (Gelli-Bianco corpus-bound). */
  legalAudit?: LegalAuditResult;
  /** Dedicated LLM economic / prescribing appropriateness audit. */
  economicAudit?: EconomicAuditResult;
}): Prisma.SessionReportUncheckedUpdateInput {
  const {
    userId,
    caseId,
    clinicalCase,
    evaluationChatHistory,
    normalizedReportText,
    evaluation,
    guidelines,
    totalScore,
    completedAt,
    simulationElapsedMinutes,
    fatalErrors = [],
    killerSwitch,
    legalAudit,
    economicAudit,
  } = params;

  const scores = evaluation.scores ?? {
    clinical: 0,
    legal: 0,
    exams: 0,
    economy: 0,
    empathy: 0,
  };
  const feedback = evaluation.feedback ?? {
    strengths: [] as string[],
    weaknesses: [] as string[],
    clinicalNote: "",
    legalComplianceNote: "",
    prescribingNote: "",
    empathyNote: "",
    economyNote: "",
    correctSolution: "",
  };

  const evalLegalSources = Array.isArray(evaluation.evidence?.legalSources)
    ? evaluation.evidence.legalSources
    : [];
  const evalProtocolSources = Array.isArray(evaluation.evidence?.protocolSources)
    ? evaluation.evidence.protocolSources
    : [];
  const guidelineLegalSources = Array.isArray(guidelines.legal?.sources)
    ? guidelines.legal.sources
    : [];
  const guidelineProtocolSources = Array.isArray(guidelines.protocol?.sources)
    ? guidelines.protocol.sources
    : [];

  const legalEvidenceSources =
    evalLegalSources.length > 0 ? evalLegalSources : guidelineLegalSources;

  const protocolEvidenceSources =
    evalProtocolSources.length > 0 ? evalProtocolSources : guidelineProtocolSources;

  const killerSwitchTrace: KillerSwitchTrace = killerSwitch ?? {
    applied: false,
    rawTotalTrentesimi: totalScore,
    finalTotalTrentesimi: totalScore,
    cap: 17.9,
  };

  return {
    userId,
    caseId,
    clinicalAccuracy: scores.clinical,
    legalComplianceGelliBianco: scores.legal,
    /** Exam appropriateness (0–100) — feeds the 20% weight of the /30 grade. */
    prescribingAppropriateness: scores.exams,
    /**
     * Economic sustainability indicator (0–100) — radar / bilancio SSN only.
     * Distinct from prescribingAppropriateness; not used in computeTotalScoreTrentesimi.
     */
    economicSustainability: scores.economy,
    empathy: scores.empathy,
    totalScore,
    medicalSpecialtyIdSnapshot: clinicalCase?.medicalSpecialtyId ?? null,
    medicalSpecialtyNameSnapshot:
      clinicalCase?.medicalSpecialty?.name ?? clinicalCase?.specialty ?? null,
    difficultySnapshot: clinicalCase?.difficulty ?? null,
    completedAt,
    status: "COMPLETED",
    progress: 100,
    progressMessage: "Report pronto!",
    rawTrace: {
      /** Explicit false so dashboard JSON filters never treat missing keys as dismissed. */
      dismissed: false,
      chatHistory: Array.isArray(evaluationChatHistory) ? evaluationChatHistory : [],
      exams: Array.isArray(evaluation.resolvedExams) ? evaluation.resolvedExams : [],
      resolvedExams: Array.isArray(evaluation.resolvedExams) ? evaluation.resolvedExams : [],
      reportText: normalizedReportText ?? "",
      feedback,
      analytical: {
        criticalActions: Array.isArray(evaluation.criticalActions)
          ? evaluation.criticalActions
          : [],
        inappropriateActions: Array.isArray(evaluation.inappropriateActions)
          ? evaluation.inappropriateActions
          : [],
        empathyChecklist: Array.isArray(evaluation.empathyChecklist)
          ? evaluation.empathyChecklist
          : [],
        legalProtectionStatus: evaluation.legalProtectionStatus,
        clinicalDeltaTable: Array.isArray(evaluation.clinicalDeltaTable)
          ? evaluation.clinicalDeltaTable
          : [],
        economicAnalysis: evaluation.economicAnalysis,
        coachingFeedback: evaluation.coachingFeedback,
        fatalErrors: Array.isArray(evaluation.fatalErrors) ? evaluation.fatalErrors : [],
      },
      /** Full deterministic Killer-Switch audit trail for coaching / appeals. */
      fatalErrors: Array.isArray(fatalErrors) ? fatalErrors : [],
      killerSwitch: killerSwitchTrace,
      scoreBreakdown: evaluation.scoreBreakdown ?? null,
      /** Explicit empathy behavioral contract for report UI. */
      empathyBreakdown: evaluation.scoreBreakdown?.empathy ?? null,
      examEconomics: {
        budgetEuro: evaluation.examBudgetEuro ?? null,
        totalCostEuro: evaluation.totalExamCostEuro ?? null,
      },
      helpTelemetry: evaluation.helpTelemetry ?? {
        helpRequested: false,
        helpRequestCount: 0,
      },
      ...(typeof simulationElapsedMinutes === "number" && simulationElapsedMinutes > 0
        ? { simulationElapsedMinutes }
        : {}),
      evidence: {
        ...(evaluation.evidence ?? {}),
        legalSources: legalEvidenceSources,
        protocolSources: protocolEvidenceSources,
      },
      legalEvaluation: {
        retrievalSource: guidelines.legal?.source ?? "none",
        retrievalQuery: guidelines.query ?? "",
        retrievedChunks: Array.isArray(guidelines.legal?.chunks) ? guidelines.legal.chunks : [],
        retrievedSources: guidelineLegalSources,
        overallLegalScore: scores.legal,
        instrumentReviews: Array.isArray(evaluation.legalInstrumentReviews)
          ? evaluation.legalInstrumentReviews
          : [],
      },
      protocolEvaluation: {
        retrievalSource: guidelines.protocol?.source ?? "none",
        retrievedChunks: Array.isArray(guidelines.protocol?.chunks)
          ? guidelines.protocol.chunks
          : [],
        retrievedSources: guidelineProtocolSources,
      },
      ...(legalAudit ? { legalAudit } : {}),
      ...(economicAudit ? { economicAudit } : {}),
    },
    notes: typeof feedback.legalComplianceNote === "string" ? feedback.legalComplianceNote : "",
  };
}

export type EliteReportData = {
  sessionId: string;
  scores: {
    clinical: number;
    legal: number;
    exams: number;
    empathy: number;
    economy: number;
  };
  feedback?: EvaluationResult["feedback"];
  evidence?: {
    legalSources?: string[];
    protocolSources?: string[];
  };
  legalInstrumentReviews?: EvaluationResult["legalInstrumentReviews"];
  legalProtectionStatus?: LegalProtectionStatus;
  clinicalDeltaTable?: ClinicalDeltaRow[];
  economicAnalysis?: EconomicAnalysis;
  coachingFeedback?: CoachingFeedback;
  empathyBreakdown?: EmpathyBehavioralBreakdown | null;
  scoreBreakdown?: ScoreBreakdown | null;
  totalScore: number;
};

export function buildReportDataFromSession(session: {
  id: string;
  clinicalAccuracy: number;
  legalComplianceGelliBianco: number;
  prescribingAppropriateness: number;
  economicSustainability: number;
  empathy: number;
  totalScore: number;
  rawTrace: unknown;
}) {
  const trace = (session.rawTrace ?? {}) as {
    feedback?: EvaluationResult["feedback"];
    evidence?: {
      legalSources?: string[];
      protocolSources?: string[];
    };
    legalEvaluation?: { instrumentReviews?: EvaluationResult["legalInstrumentReviews"] };
    analytical?: {
      legalProtectionStatus?: LegalProtectionStatus;
      clinicalDeltaTable?: ClinicalDeltaRow[];
      economicAnalysis?: EconomicAnalysis;
      coachingFeedback?: CoachingFeedback;
    };
    empathyBreakdown?: EmpathyBehavioralBreakdown | null;
    scoreBreakdown?: ScoreBreakdown | null;
  };

  const legalEvidenceSources = trace.evidence?.legalSources ?? [];
  const protocolEvidenceSources = trace.evidence?.protocolSources ?? [];

  return {
    sessionId: session.id,
    scores: {
      clinical: session.clinicalAccuracy,
      legal: session.legalComplianceGelliBianco,
      exams: session.prescribingAppropriateness,
      empathy: session.empathy,
      economy: session.economicSustainability,
    },
    feedback: trace.feedback,
    evidence: {
      legalSources: legalEvidenceSources,
      protocolSources: protocolEvidenceSources,
    },
    legalInstrumentReviews: trace.legalEvaluation?.instrumentReviews,
    legalProtectionStatus: trace.analytical?.legalProtectionStatus,
    clinicalDeltaTable: trace.analytical?.clinicalDeltaTable,
    economicAnalysis: trace.analytical?.economicAnalysis,
    coachingFeedback: trace.analytical?.coachingFeedback,
    empathyBreakdown: trace.empathyBreakdown ?? trace.scoreBreakdown?.empathy ?? null,
    scoreBreakdown: trace.scoreBreakdown ?? null,
    totalScore: session.totalScore,
  } satisfies EliteReportData;
}
