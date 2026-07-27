import type { CaseDifficulty, Prisma } from "@prisma/client";
import type { RelevantGuidelines } from "@/lib/services/rag-service";
import type { EvaluationResult } from "@/lib/services/evaluation-service";
import type {
  ClinicalDeltaRow,
  CoachingFeedback,
  EconomicAnalysis,
  FatalError,
  LegalProtectionStatus,
} from "@/lib/services/evaluation-report-types";
import type { ChatMessage, ExamPayload } from "@/lib/services/evaluation-service";

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
  /** Deterministic fatal errors detected post-evaluation (always persisted). */
  fatalErrors?: FatalError[];
  killerSwitch?: KillerSwitchTrace;
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
    fatalErrors = [],
    killerSwitch,
  } = params;

  const { scores, feedback } = evaluation;

  const legalEvidenceSources =
    evaluation.evidence.legalSources.length > 0
      ? evaluation.evidence.legalSources
      : guidelines.legal.sources;

  const protocolEvidenceSources =
    evaluation.evidence.protocolSources.length > 0
      ? evaluation.evidence.protocolSources
      : guidelines.protocol.sources;

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
    prescribingAppropriateness: scores.exams,
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
      chatHistory: evaluationChatHistory,
      exams: evaluation.resolvedExams,
      resolvedExams: evaluation.resolvedExams,
      reportText: normalizedReportText,
      feedback,
      analytical: {
        criticalActions: evaluation.criticalActions,
        inappropriateActions: evaluation.inappropriateActions,
        empathyChecklist: evaluation.empathyChecklist,
        legalProtectionStatus: evaluation.legalProtectionStatus,
        clinicalDeltaTable: evaluation.clinicalDeltaTable,
        economicAnalysis: evaluation.economicAnalysis,
        coachingFeedback: evaluation.coachingFeedback,
        fatalErrors: evaluation.fatalErrors ?? [],
      },
      /** Full deterministic Killer-Switch audit trail for coaching / appeals. */
      fatalErrors,
      killerSwitch: killerSwitchTrace,
      scoreBreakdown: evaluation.scoreBreakdown,
      examEconomics: {
        budgetEuro: evaluation.examBudgetEuro,
        totalCostEuro: evaluation.totalExamCostEuro,
      },
      evidence: {
        ...evaluation.evidence,
        legalSources: legalEvidenceSources,
        protocolSources: protocolEvidenceSources,
      },
      legalEvaluation: {
        retrievalSource: guidelines.legal.source,
        retrievalQuery: guidelines.query,
        retrievedChunks: guidelines.legal.chunks,
        retrievedSources: guidelines.legal.sources,
        overallLegalScore: scores.legal,
        instrumentReviews: evaluation.legalInstrumentReviews,
      },
      protocolEvaluation: {
        retrievalSource: guidelines.protocol.source,
        retrievedChunks: guidelines.protocol.chunks,
        retrievedSources: guidelines.protocol.sources,
      },
    },
    notes: feedback.legalComplianceNote,
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
    totalScore: session.totalScore,
  } satisfies EliteReportData;
}
