import type { CaseDifficulty } from "@prisma/client";
import type { ExamClinicalMeta } from "@/lib/exam-default-values";
import type { ExamPayload } from "@/lib/services/evaluation-service";

export const CRITICAL_PENALTY_HIGH = 25;
export const CRITICAL_PENALTY_MEDIUM = 15;

export type CriticalActionItem = {
  description: string;
  performed: boolean;
  criticalLevel: "HIGH" | "MEDIUM";
  feedback: string;
};

export type InappropriateActionItem = {
  description: string;
  performed: boolean;
  penaltyWeight: number;
  feedback: string;
};

export type EmpathyChecklistItem = {
  parameter: string;
  met: boolean;
  feedback: string;
};

export type LegalInstrumentReview = {
  instrument: string;
  documentTitle?: string;
  compliance: "rispettato" | "violato" | "parziale" | "non_applicabile";
  rationale: string;
};

export type DimensionScores = {
  clinical: number;
  legal: number;
  exams: number;
  economy: number;
  empathy: number;
};

export type ScoreBreakdown = {
  clinical: {
    base: number;
    missedHigh: number;
    missedMedium: number;
    penaltyHigh: number;
    penaltyMedium: number;
    final: number;
  };
  exams: {
    base: number;
    penaltySum: number;
    performedInappropriateCount: number;
    final: number;
  };
  economy: {
    budgetEuro: number;
    totalCostEuro: number;
    formula: string;
    final: number;
  };
  legal: {
    applicableInstruments: number;
    violated: number;
    partial: number;
    weightPerInstrument: number;
    final: number;
    /** Accepted RAG source titles used for legal scoring (0 ⇒ soft-fail). */
    ragSourcesCount?: number;
    /** False when Pinecone/DB returned no usable legal corpus. */
    hasLegalContext?: boolean;
    /** True when legal dimension is not verifiable — neutral score applied. */
    unevaluable?: boolean;
  };
  empathy: {
    totalParameters: number;
    metParameters: number;
    final: number;
  };
};

const DEFAULT_BUDGET_BY_DIFFICULTY: Record<CaseDifficulty, number> = {
  EASY: 250,
  MEDIUM: 400,
  HARD: 600,
};

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

/** Resolves per-case exam budget from baseline JSON or difficulty tier. */
export function resolveExamBudgetEuro(
  difficulty?: CaseDifficulty,
  baselineExamFindings?: unknown,
): number {
  const baseline = baselineExamFindings as { examBudgetEuro?: number } | null | undefined;
  if (typeof baseline?.examBudgetEuro === "number" && baseline.examBudgetEuro > 0) {
    return baseline.examBudgetEuro;
  }
  return DEFAULT_BUDGET_BY_DIFFICULTY[difficulty ?? "MEDIUM"];
}

/** Overlays authoritative exam prices from the catalog/DB config. */
export function resolveExamCostsFromCatalog(
  exams: ExamPayload[],
  catalog: Record<string, ExamClinicalMeta>,
): { exams: ExamPayload[]; totalCostEuro: number } {
  const resolved = exams.map((exam) => ({
    ...exam,
    cost: (catalog[exam.id]?.price ?? Number(exam.cost)) || 0,
  }));

  const totalCostEuro = resolved.reduce((sum, exam) => sum + (Number(exam.cost) || 0), 0);
  return { exams: resolved, totalCostEuro };
}

/**
 * Accuratezza clinica: 100 − 25 per ogni azione critica HIGH non eseguita,
 * −15 per ogni azione critica MEDIUM non eseguita.
 */
export function computeClinicalAccuracyScore(criticalActions: CriticalActionItem[]): {
  score: number;
  breakdown: ScoreBreakdown["clinical"];
} {
  const missedHigh = criticalActions.filter((a) => !a.performed && a.criticalLevel === "HIGH");
  const missedMedium = criticalActions.filter((a) => !a.performed && a.criticalLevel === "MEDIUM");
  const penaltyHigh = missedHigh.length * CRITICAL_PENALTY_HIGH;
  const penaltyMedium = missedMedium.length * CRITICAL_PENALTY_MEDIUM;
  const final = clampScore(100 - penaltyHigh - penaltyMedium);

  return {
    score: final,
    breakdown: {
      base: 100,
      missedHigh: missedHigh.length,
      missedMedium: missedMedium.length,
      penaltyHigh,
      penaltyMedium,
      final,
    },
  };
}

/**
 * Appropriatezza prescrittiva: 100 − somma penaltyWeight delle inappropriateActions eseguite.
 */
export function computeAppropriatenessScore(inappropriateActions: InappropriateActionItem[]): {
  score: number;
  breakdown: ScoreBreakdown["exams"];
} {
  const performed = inappropriateActions.filter((a) => a.performed);
  const penaltySum = performed.reduce((sum, a) => sum + Math.max(0, a.penaltyWeight), 0);
  const final = clampScore(100 - penaltySum);

  return {
    score: final,
    breakdown: {
      base: 100,
      penaltySum,
      performedInappropriateCount: performed.length,
      final,
    },
  };
}

/**
 * Sostenibilità economica: se costo ≤ budget → 100; altrimenti 100 × (budget / costo).
 */
export function computeEconomicSustainabilityScore(
  totalCostEuro: number,
  budgetEuro: number,
): { score: number; breakdown: ScoreBreakdown["economy"] } {
  if (totalCostEuro <= 0) {
    return {
      score: 100,
      breakdown: {
        budgetEuro,
        totalCostEuro: 0,
        formula: "Nessun esame a pagamento richiesto",
        final: 100,
      },
    };
  }

  if (totalCostEuro <= budgetEuro) {
    return {
      score: 100,
      breakdown: {
        budgetEuro,
        totalCostEuro,
        formula: "Costo entro budget",
        final: 100,
      },
    };
  }

  const raw = 100 * (budgetEuro / totalCostEuro);
  const final = clampScore(raw);

  return {
    score: final,
    breakdown: {
      budgetEuro,
      totalCostEuro,
      formula: `100 × (${budgetEuro} / ${totalCostEuro.toFixed(2)})`,
      final,
    },
  };
}

/**
 * Neutral safeguard score when no RAG legal corpus is available.
 * Prevents defaulting to 100/100 (false "fully protected") on soft-fail.
 */
export const LEGAL_SOFT_FAIL_NEUTRAL_SCORE = 50;

/**
 * Tutela legale: quota proporzionale per strumento applicabile dal corpus RAG.
 * violato → −100%; parziale → −50%; non_applicabile → ignorato.
 *
 * Soft-fail: if `hasLegalContext` is false or `ragSourcesCount` is 0,
 * returns a neutral score (never 100) and marks the dimension unevaluable.
 */
export function computeLegalComplianceScore(
  reviews: LegalInstrumentReview[],
  options?: {
    hasLegalContext?: boolean;
    ragSourcesCount?: number;
  },
): {
  score: number;
  breakdown: ScoreBreakdown["legal"];
} {
  const safeReviews = Array.isArray(reviews) ? reviews : [];
  const hasLegalContext = options?.hasLegalContext ?? true;
  const ragSourcesCount =
    typeof options?.ragSourcesCount === "number"
      ? Math.max(0, options.ragSourcesCount)
      : hasLegalContext
        ? 1
        : 0;

  if (!hasLegalContext || ragSourcesCount === 0) {
    return {
      score: LEGAL_SOFT_FAIL_NEUTRAL_SCORE,
      breakdown: {
        applicableInstruments: 0,
        violated: 0,
        partial: 0,
        weightPerInstrument: 0,
        final: LEGAL_SOFT_FAIL_NEUTRAL_SCORE,
        ragSourcesCount: 0,
        hasLegalContext: false,
        unevaluable: true,
      },
    };
  }

  const applicable = safeReviews.filter((r) => r.compliance !== "non_applicabile");
  if (applicable.length === 0) {
    // Corpus present but AI marked everything non_applicabile — still not a free 100.
    return {
      score: LEGAL_SOFT_FAIL_NEUTRAL_SCORE,
      breakdown: {
        applicableInstruments: 0,
        violated: 0,
        partial: 0,
        weightPerInstrument: 0,
        final: LEGAL_SOFT_FAIL_NEUTRAL_SCORE,
        ragSourcesCount,
        hasLegalContext: true,
        unevaluable: true,
      },
    };
  }

  const weightPerInstrument = 100 / applicable.length;
  let penalty = 0;
  let violated = 0;
  let partial = 0;

  for (const review of applicable) {
    if (review.compliance === "violato") {
      penalty += weightPerInstrument;
      violated += 1;
    } else if (review.compliance === "parziale") {
      penalty += weightPerInstrument * 0.5;
      partial += 1;
    }
  }

  const final = clampScore(100 - penalty);

  return {
    score: final,
    breakdown: {
      applicableInstruments: applicable.length,
      violated,
      partial,
      weightPerInstrument: Math.round(weightPerInstrument * 100) / 100,
      final,
      ragSourcesCount,
      hasLegalContext: true,
      unevaluable: false,
    },
  };
}

/** Empatia: (parametri soddisfatti / totali) × 100. */
export function computeEmpathyScore(checklist: EmpathyChecklistItem[]): {
  score: number;
  breakdown: ScoreBreakdown["empathy"];
} {
  if (checklist.length === 0) {
    return {
      score: 0,
      breakdown: { totalParameters: 0, metParameters: 0, final: 0 },
    };
  }

  const metParameters = checklist.filter((item) => item.met).length;
  const final = clampScore((metParameters / checklist.length) * 100);

  return {
    score: final,
    breakdown: {
      totalParameters: checklist.length,
      metParameters,
      final,
    },
  };
}

export function deriveDimensionScores(params: {
  criticalActions: CriticalActionItem[];
  inappropriateActions: InappropriateActionItem[];
  empathyChecklist: EmpathyChecklistItem[];
  legalInstrumentReviews: LegalInstrumentReview[];
  totalCostEuro: number;
  budgetEuro: number;
  /** When false, legal score soft-fails to a neutral value (never 100). */
  hasLegalContext?: boolean;
  /** Number of accepted RAG legal source titles (0 ⇒ soft-fail). */
  ragSourcesCount?: number;
}): { scores: DimensionScores; breakdown: ScoreBreakdown } {
  const clinical = computeClinicalAccuracyScore(params.criticalActions);
  const exams = computeAppropriatenessScore(params.inappropriateActions);
  const economy = computeEconomicSustainabilityScore(params.totalCostEuro, params.budgetEuro);
  const legal = computeLegalComplianceScore(params.legalInstrumentReviews, {
    hasLegalContext: params.hasLegalContext,
    ragSourcesCount: params.ragSourcesCount,
  });
  const empathy = computeEmpathyScore(params.empathyChecklist);

  return {
    scores: {
      clinical: clinical.score,
      legal: legal.score,
      exams: exams.score,
      economy: economy.score,
      empathy: empathy.score,
    },
    breakdown: {
      clinical: clinical.breakdown,
      exams: exams.breakdown,
      economy: economy.breakdown,
      legal: legal.breakdown,
      empathy: empathy.breakdown,
    },
  };
}

/** Weight distribution for the four macro-areas (must sum to 1). */
export const MACRO_AREA_WEIGHTS = {
  clinicalDiagnostic: 0.3,
  legalCompliance: 0.3,
  economicSustainability: 0.2,
  empathy: 0.2,
} as const;

/** Weighted sum of dimension scores on a 0–30 trentesimi scale. */
export function computeTotalScoreTrentesimi(scores: DimensionScores): number {
  const w = MACRO_AREA_WEIGHTS;
  const total =
    (scores.clinical / 100) * w.clinicalDiagnostic * 30 +
    (scores.legal / 100) * w.legalCompliance * 30 +
    (scores.exams / 100) * w.economicSustainability * 30 +
    (scores.empathy / 100) * w.empathy * 30;
  return Math.round(total * 10) / 10;
}
