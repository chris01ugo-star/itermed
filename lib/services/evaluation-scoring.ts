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
  /** Accuratezza clinica diagnostico-terapeutica (0–100). Weight 30% → max 9/30. */
  clinical: number;
  /** Sicurezza / tutela legale (0–100). Weight 30% → max 9/30. */
  legal: number;
  /**
   * Appropriatezza prescrittiva degli esami (0–100).
   * Weight 20% → max 6/30 in `computeTotalScoreTrentesimi`.
   * Persisted as SessionReport.prescribingAppropriateness.
   */
  exams: number;
  /**
   * Sostenibilità economica / budget SSN (0–100) — analytical / radar only.
   * Persisted as SessionReport.economicSustainability.
   * NOT weighted into the final /30 grade.
   */
  economy: number;
  /** Comunicazione ed empatia (0–100). Weight 20% → max 6/30. */
  empathy: number;
};

/** Behavioral empathy audit trail persisted in scoreBreakdown / report UI. */
export type EmpathyBehavioralBreakdown = {
  baseline: number;
  validationBonus: number;
  transparencyBonus: number;
  allianceBonus: number;
  dismissalPenalty: number;
  finalScore: number;
  final: number;
  qualitativeLabel: string;
  totalParameters?: number;
  metParameters?: number;
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
  empathy: EmpathyBehavioralBreakdown;
};

/**
 * Clinical behavioral psychology — professional communication starts at 60/100.
 * Bonuses for validation / transparency / alliance; penalties only for explicit harm.
 */
export const EMPATHY_PROFESSIONAL_BASELINE = 60;

/** @deprecated Use EMPATHY_PROFESSIONAL_BASELINE (behavioral model). */
export const EMPATHY_EMPTY_CHECKLIST_BASELINE = EMPATHY_PROFESSIONAL_BASELINE;

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
  const baseline =
    baselineExamFindings &&
    typeof baselineExamFindings === "object" &&
    !Array.isArray(baselineExamFindings)
      ? (baselineExamFindings as { examBudgetEuro?: unknown })
      : null;
  const budget = Number(baseline?.examBudgetEuro);
  if (Number.isFinite(budget) && budget > 0) {
    return budget;
  }
  return DEFAULT_BUDGET_BY_DIFFICULTY[difficulty ?? "MEDIUM"] ?? DEFAULT_BUDGET_BY_DIFFICULTY.MEDIUM;
}

/** Overlays authoritative exam prices from the catalog/DB config. */
export function resolveExamCostsFromCatalog(
  exams: ExamPayload[] | null | undefined,
  catalog: Record<string, ExamClinicalMeta> | null | undefined,
): { exams: ExamPayload[]; totalCostEuro: number } {
  const safeExams = Array.isArray(exams) ? exams : [];
  const safeCatalog = catalog ?? {};
  const resolved = safeExams.map((exam) => ({
    ...exam,
    cost: (safeCatalog[exam.id]?.price ?? Number(exam.cost)) || 0,
  }));

  const totalCostEuro = resolved.reduce((sum, exam) => sum + (Number(exam.cost) || 0), 0);
  return { exams: resolved, totalCostEuro };
}

/**
 * Accuratezza clinica: 100 − 25 per ogni azione critica HIGH non eseguita,
 * −15 per ogni azione critica MEDIUM non eseguita.
 */
export function computeClinicalAccuracyScore(
  criticalActions: CriticalActionItem[] | null | undefined,
): {
  score: number;
  breakdown: ScoreBreakdown["clinical"];
} {
  const actions = Array.isArray(criticalActions) ? criticalActions : [];
  const missedHigh = actions.filter((a) => !a.performed && a.criticalLevel === "HIGH");
  const missedMedium = actions.filter((a) => !a.performed && a.criticalLevel === "MEDIUM");
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
export function computeAppropriatenessScore(
  inappropriateActions: InappropriateActionItem[] | null | undefined,
): {
  score: number;
  breakdown: ScoreBreakdown["exams"];
} {
  const actions = Array.isArray(inappropriateActions) ? inappropriateActions : [];
  const performed = actions.filter((a) => a.performed);
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

/**
 * Empathy evaluation — clinical behavioral psychology model.
 * @see computeBehavioralEmpathyScore
 */

const VALIDATION_RE =
  /capisco|comprendo|mi dispiace|la sua ansia|preoccupat[oaie]?|paura|angoscia|disagio|è normale sentirsi|riconosco (che|il)|dev['’]?essere difficil|come si sente|il suo stress|la capisco|la rassicuro|non è sola|non è solo/i;

const TRANSPARENCY_RE =
  /le spiego|in parole semplic|significa che|cioè\b|in pratica|faremo (un |una )?|l['’]esame serve|serve a|senza (dolore|rischi?o)|per capire meglio|le dico|passo dopo passo|in termini semplici|le racconto (cosa|come)/i;

const ALLIANCE_RE =
  /ha domande|domande\s*\?|stia tranquillo|stia seren|ora (facciamo|procediamo|vediamo)|insieme (a lei|facciamo)|d['’]accordo\s*\?|mi segue|si senta liber|posso (aiutarla|rispondere)|la accompagno|procediamo insieme/i;

const BRUSQUE_RE =
  /\b(faccia subito|deve stare zitt|non c['’]è tempo|sbrighi?ati|solo s[iì] o no|non interrompa|basta cos[iì]|non mi interessa)\b|!{2,}/i;

const UNEXPLAINED_JARGON_RE =
  /\b(STEMI|NSTEMI|troponina(?:-hs)?|emogasanalisi|emogas|ECG|TC\b|TAC\b|RMN|fibrinolisi|PCI|SpO₂|SpO2|PAS|PAD|GCS|shock\s+ipovol)\b/i;

const PATIENT_ANXIETY_RE =
  /paura|ansios[oa]|ansia|preoccupat[oa]|ho paura|non ce la faccio|sto malissimo|aiuto|terrorizzat|agitato|mi sento male|ho paura di/i;

function scaledBonus(hitCount: number, minBonus: number, maxBonus: number): number {
  if (hitCount <= 0) return 0;
  if (hitCount === 1) return minBonus;
  if (hitCount === 2) return Math.round((minBonus + maxBonus) / 2);
  return maxBonus;
}

export function qualitativeEmpathyLabel(breakdown: {
  finalScore: number;
  validationBonus: number;
  transparencyBonus: number;
  allianceBonus: number;
  dismissalPenalty: number;
}): string {
  const { finalScore, validationBonus, transparencyBonus, allianceBonus, dismissalPenalty } =
    breakdown;

  if (dismissalPenalty >= 25 && finalScore < 60) {
    return "Comunicazione a rischio — tono brusco o disattenzione all'ansia";
  }
  if (finalScore >= 85 && allianceBonus >= 10 && validationBonus >= 10) {
    return "Eccellente alleanza terapeutica e validazione emotiva";
  }
  if (finalScore >= 75 && allianceBonus >= 10) {
    return "Buona alleanza terapeutica";
  }
  if (finalScore >= 70 && transparencyBonus >= 10 && validationBonus < 10) {
    return "Comunicazione tecnica ma rispettosa";
  }
  if (finalScore >= 60) {
    return "Comunicazione professionale corretta";
  }
  if (finalScore >= 45) {
    return "Empatia insufficiente — gap di validazione o trasparenza";
  }
  return "Comunicazione a rischio — tono brusco o disattenzione all'ansia";
}

/**
 * Behavioral empathy from doctor↔patient chat turns.
 * Baseline 60; bonuses for validation/transparency/alliance; penalties only on explicit harm.
 * Without negative behaviors, score never falls below 60.
 */
export function computeBehavioralEmpathyScore(params: {
  chatHistory?: Array<{ role: string; content: string }> | null;
  /** Optional LLM checklist — telemetry only, does not drive the score. */
  empathyChecklist?: EmpathyChecklistItem[] | null;
}): { score: number; breakdown: EmpathyBehavioralBreakdown } {
  const chat = Array.isArray(params.chatHistory) ? params.chatHistory : [];
  const doctorTurns = chat
    .filter((m) => m.role === "user" && typeof m.content === "string")
    .map((m) => m.content.trim())
    .filter(Boolean);
  const patientTurns = chat
    .filter((m) => m.role === "assistant" && typeof m.content === "string")
    .map((m) => m.content.trim())
    .filter(Boolean);

  let validationHits = 0;
  let transparencyHits = 0;
  let allianceHits = 0;
  let brusqueHits = 0;
  let jargonHits = 0;

  for (const turn of doctorTurns) {
    if (VALIDATION_RE.test(turn)) validationHits += 1;
    if (TRANSPARENCY_RE.test(turn)) transparencyHits += 1;
    if (ALLIANCE_RE.test(turn)) allianceHits += 1;
    if (BRUSQUE_RE.test(turn)) brusqueHits += 1;
    if (UNEXPLAINED_JARGON_RE.test(turn) && !TRANSPARENCY_RE.test(turn)) {
      jargonHits += 1;
    }
  }

  const validationBonus = scaledBonus(validationHits, 10, 20);
  const transparencyBonus = scaledBonus(transparencyHits, 10, 20);
  const allianceBonus = allianceHits > 0 ? 10 : 0;

  let dismissalPenalty = 0;
  // Disattenzione all'ansia espressa dal paziente (−15, once).
  let anxietyIgnored = false;
  for (let i = 0; i < chat.length - 1; i += 1) {
    const cur = chat[i];
    const next = chat[i + 1];
    if (
      cur?.role === "assistant" &&
      next?.role === "user" &&
      PATIENT_ANXIETY_RE.test(cur.content) &&
      !VALIDATION_RE.test(next.content) &&
      !ALLIANCE_RE.test(next.content)
    ) {
      anxietyIgnored = true;
      break;
    }
  }
  if (!anxietyIgnored) {
    const lastAnxietyIdx = [...patientTurns.keys()]
      .reverse()
      .find((idx) => PATIENT_ANXIETY_RE.test(patientTurns[idx] ?? ""));
    if (typeof lastAnxietyIdx === "number") {
      let patientSeen = -1;
      for (let i = 0; i < chat.length; i += 1) {
        if (chat[i]?.role !== "assistant") continue;
        patientSeen += 1;
        if (patientSeen !== lastAnxietyIdx) continue;
        const laterDoctor = chat
          .slice(i + 1)
          .filter((m) => m.role === "user")
          .map((m) => m.content);
        if (
          laterDoctor.length > 0 &&
          !laterDoctor.some((t) => VALIDATION_RE.test(t) || ALLIANCE_RE.test(t))
        ) {
          anxietyIgnored = true;
        }
        break;
      }
    }
  }
  if (anxietyIgnored) dismissalPenalty += 15;
  if (brusqueHits > 0) dismissalPenalty += 25;
  if (jargonHits > 0) dismissalPenalty += 15;

  const raw =
    EMPATHY_PROFESSIONAL_BASELINE +
    validationBonus +
    transparencyBonus +
    allianceBonus -
    dismissalPenalty;

  // Floor at baseline when no explicit negative behaviors.
  const floored = dismissalPenalty === 0 ? Math.max(EMPATHY_PROFESSIONAL_BASELINE, raw) : raw;
  const finalScore = clampScore(floored);

  const checklist = Array.isArray(params.empathyChecklist) ? params.empathyChecklist : [];
  const metParameters = checklist.filter((item) => item.met).length;

  const partial = {
    finalScore,
    validationBonus,
    transparencyBonus,
    allianceBonus,
    dismissalPenalty,
  };

  const breakdown: EmpathyBehavioralBreakdown = {
    baseline: EMPATHY_PROFESSIONAL_BASELINE,
    validationBonus,
    transparencyBonus,
    allianceBonus,
    dismissalPenalty,
    finalScore,
    final: finalScore,
    qualitativeLabel: qualitativeEmpathyLabel(partial),
    totalParameters: checklist.length,
    metParameters,
  };

  return { score: finalScore, breakdown };
}

/**
 * @deprecated Prefer computeBehavioralEmpathyScore with chatHistory.
 * Checklist-only path returns the professional baseline (60).
 */
export function computeEmpathyScore(checklist: EmpathyChecklistItem[]): {
  score: number;
  breakdown: EmpathyBehavioralBreakdown;
} {
  return computeBehavioralEmpathyScore({ empathyChecklist: checklist, chatHistory: [] });
}

export function deriveDimensionScores(params: {
  criticalActions: CriticalActionItem[];
  inappropriateActions: InappropriateActionItem[];
  empathyChecklist: EmpathyChecklistItem[];
  legalInstrumentReviews: LegalInstrumentReview[];
  totalCostEuro: number;
  budgetEuro: number;
  /** Doctor↔patient transcript for behavioral empathy scoring. */
  chatHistory?: Array<{ role: string; content: string }> | null;
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
  const empathy = computeBehavioralEmpathyScore({
    chatHistory: params.chatHistory,
    empathyChecklist: params.empathyChecklist,
  });

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

/**
 * Official weights for the final grade on the 0–30 (trentesimi) scale.
 * Must sum to 1.0. Max contribution per area:
 *   - Clinical Diagnostic → 30% → max 9/30  (DimensionScores.clinical)
 *   - Legal Compliance    → 30% → max 9/30  (DimensionScores.legal)
 *   - Exam Appropriateness→ 20% → max 6/30  (DimensionScores.exams)
 *   - Empathy & Communication → 20% → max 6/30 (DimensionScores.empathy)
 *
 * IMPORTANT — `exams` vs `economy`:
 * - `scores.exams` (DB: prescribingAppropriateness) is the **prescriptive appropriateness**
 *   of ordered exams and is the dimension weighted at 20% in the final /30 grade.
 * - `scores.economy` (DB: economicSustainability) is an **analytical budget/SSN indicator**
 *   used for radar charts and the economic panel; it is NOT a weight in
 *   `computeTotalScoreTrentesimi`.
 */
export const MACRO_AREA_WEIGHTS = {
  clinicalDiagnostic: 0.3,
  legalCompliance: 0.3,
  examAppropriateness: 0.2,
  empathy: 0.2,
} as const;

/** Max trentesimi contribution for each official weight (weight × 30). */
export const MACRO_AREA_MAX_TRENTESIMI = {
  clinicalDiagnostic: 9,
  legalCompliance: 9,
  examAppropriateness: 6,
  empathy: 6,
} as const;

/**
 * Contribution of a 0–100 dimension score to the final /30 grade.
 * Returns a value in [0, weight×30], rounded to 1 decimal; never NaN.
 */
export function dimensionContributionTrentesimi(
  scorePercent: number,
  weight: number,
): number {
  const pct = Number.isFinite(scorePercent) ? Math.max(0, Math.min(100, scorePercent)) : 0;
  const w = Number.isFinite(weight) ? Math.max(0, Math.min(1, weight)) : 0;
  return Math.round((pct / 100) * w * 30 * 10) / 10;
}

/**
 * Weighted sum of the four official macro-areas on a 0–30 trentesimi scale.
 * Uses `scores.exams` (appropriateness) for the 20% exam weight — not `scores.economy`.
 */
export function computeTotalScoreTrentesimi(scores: DimensionScores): number {
  const w = MACRO_AREA_WEIGHTS;
  const total =
    dimensionContributionTrentesimi(scores.clinical, w.clinicalDiagnostic) +
    dimensionContributionTrentesimi(scores.legal, w.legalCompliance) +
    dimensionContributionTrentesimi(scores.exams, w.examAppropriateness) +
    dimensionContributionTrentesimi(scores.empathy, w.empathy);
  // Hard clamp — never NaN / never > 30.
  if (!Number.isFinite(total)) return 0;
  return Math.min(30, Math.max(0, Math.round(total * 10) / 10));
}
