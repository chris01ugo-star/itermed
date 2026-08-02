import type { AnalyticalEvaluation } from "@/lib/services/evaluation-service";
import type { FatalError } from "@/lib/services/evaluation-report-types";
import type { DimensionScores, ScoreBreakdown } from "@/lib/services/evaluation-scoring";
import type { MilestoneScoreBreakdown } from "@/lib/services/evaluation-milestone-scoring";
import {
  MACRO_AREA_WEIGHTS,
  computeTotalScoreTrentesimi,
  dimensionContributionTrentesimi,
} from "@/lib/services/evaluation-scoring";

const KILLER_SWITCH_CAP = 17.9;
const FATAL_OMISSION_PATTERN =
  /tc\s*encefal|tac\s*encefal|ictus|stroke|fibrinol|rtpa|alteplase|allerg|anafil|controindic|emorragia cerebr|stemi|infarto acut/i;

/** Detects clinically fatal errors from structured evaluation checklist. */
export function detectFatalErrors(analytical: AnalyticalEvaluation): FatalError[] {
  const seen = new Set<string>();
  const errors: FatalError[] = [];

  const push = (description: string, rationale: string) => {
    const key = description.slice(0, 80);
    if (seen.has(key)) return;
    seen.add(key);
    errors.push({ description, rationale });
  };

  for (const action of analytical.criticalActions ?? []) {
    if (!action?.performed && action?.criticalLevel === "HIGH") {
      push(action.description ?? "Azione critica omessa", action.feedback ?? "");
    }
  }

  for (const action of analytical.inappropriateActions ?? []) {
    if (action?.performed && (action.penaltyWeight ?? 0) >= 30) {
      push(
        `Azione inappropriata: ${action.description ?? "n/d"}`,
        action.feedback ?? "",
      );
    }
  }

  for (const row of analytical.clinicalDeltaTable ?? []) {
    if (!row || (row.status !== "MISSED" && row.status !== "DELAYED")) continue;
    const combined = `${row.protocolAction ?? ""} ${row.penaltyOrBonusReason ?? ""}`;
    const isFatalPattern = FATAL_OMISSION_PATTERN.test(combined);
    const isLifeThreatening =
      /red flag|salvavita|emergenza|entro\s*\d|fatale|catastrof/i.test(combined);
    if (isFatalPattern || (row.status === "MISSED" && isLifeThreatening)) {
      push(row.protocolAction ?? "Omissione critica", row.penaltyOrBonusReason ?? "");
    }
  }

  for (const review of analytical.legalInstrumentReviews ?? []) {
    if (
      review?.compliance === "violato" &&
      /gelli|24\/2017|consenso|allerg|farmaco/i.test(
        `${review.instrument ?? ""}${review.rationale ?? ""}`,
      )
    ) {
      push(`Violazione ${review.instrument ?? "strumento legale"}`, review.rationale ?? "");
    }
  }

  for (const fatal of analytical.fatalErrors ?? []) {
    if (!fatal) continue;
    push(fatal.description ?? "Errore fatale", fatal.rationale ?? "");
  }

  return errors;
}

/** Killer Switch: fatal clinical error caps final grade below 18/30. */
export function applyKillerSwitch(totalScore: number, fatalErrors: FatalError[]): number {
  if (fatalErrors.length === 0) return totalScore;
  return Math.min(totalScore, KILLER_SWITCH_CAP);
}

export type MacroAreaRationale = {
  label: string;
  weightPercent: number;
  scorePercent: number;
  contributionTrentesimi: number;
  rationale: string;
};

export function buildMacroAreaRationales(
  scores: DimensionScores,
  breakdown: ScoreBreakdown,
  milestoneBreakdown?: MilestoneScoreBreakdown,
): MacroAreaRationale[] {
  const mb = milestoneBreakdown;

  return [
    {
      label: "Accuratezza Clinica",
      weightPercent: MACRO_AREA_WEIGHTS.clinicalDiagnostic * 100,
      scorePercent: scores.clinical,
      contributionTrentesimi: dimensionContributionTrentesimi(
        scores.clinical,
        MACRO_AREA_WEIGHTS.clinicalDiagnostic,
      ),
      rationale: mb
        ? `Deterministico: ${mb.clinical.goldStepsMet}/${mb.clinical.goldStepsExpected} step Gold Standard + ${mb.clinical.met} milestone clinici (${mb.clinical.ratePercent}%).`
        : `Accuratezza diagnostico-terapeutica: ${breakdown.clinical.final}/100.`,
    },
    {
      label: "Sicurezza del Paziente",
      weightPercent: MACRO_AREA_WEIGHTS.legalCompliance * 100,
      scorePercent: scores.legal,
      contributionTrentesimi: dimensionContributionTrentesimi(
        scores.legal,
        MACRO_AREA_WEIGHTS.legalCompliance,
      ),
      rationale: mb
        ? `Allergie/farmaci/parametri: ${mb.safety.met}/${mb.safety.expected} controlli (${mb.safety.vitalsMet ? "monitoraggio presente" : "monitoraggio assente"}).`
        : `Sicurezza paziente: ${breakdown.legal.final}/100.`,
    },
    {
      label: "Appropriatezza Prescrittiva (Esami)",
      weightPercent: MACRO_AREA_WEIGHTS.examAppropriateness * 100,
      scorePercent: scores.exams,
      contributionTrentesimi: dimensionContributionTrentesimi(
        scores.exams,
        MACRO_AREA_WEIGHTS.examAppropriateness,
      ),
      rationale: mb
        ? `Base 100% − ${mb.appropriateness.penaltyPercent}% (${mb.appropriateness.inappropriateCount} inappropriate + ${mb.appropriateness.tier3WithoutIndication} esami III livello senza indicazione). Budget analitico €${breakdown.economy.budgetEuro} vs €${breakdown.economy.totalCostEuro.toFixed(2)} (economia = metrica radar, non peso /30).`
        : `Appropriatezza prescrittiva (scores.exams): ${breakdown.exams.final}/100. Economia (scores.economy) esclusa dal voto /30.`,
    },
    {
      label: "Comunicazione ed Empatia",
      weightPercent: MACRO_AREA_WEIGHTS.empathy * 100,
      scorePercent: scores.empathy,
      contributionTrentesimi: dimensionContributionTrentesimi(
        scores.empathy,
        MACRO_AREA_WEIGHTS.empathy,
      ),
      rationale: mb
        ? `Milestone empatici: ${mb.empathy.met}/${mb.empathy.expected} (rassicurazione, gestione stress).`
        : `Empatia: ${breakdown.empathy.metParameters}/${breakdown.empathy.totalParameters} parametri.`,
    },
  ];
}

export function computeFinalTrentesimiWithKillerSwitch(
  scores: DimensionScores,
  fatalErrors: FatalError[],
): {
  rawTotal: number;
  finalTotal: number;
  killerSwitchApplied: boolean;
  /** Scores used ONLY to compute the capped total — never overwrite persisted legal/empathy. */
  adjustedScoresForTotal: DimensionScores;
  /** Authentic dimension scores for SessionReport columns / UI radar. */
  scoresForPersist: DimensionScores;
} {
  const scoresForPersist = { ...scores };
  // Fatal clinical errors reduce the safety contribution in the TOTAL only.
  // Persisting legal=0 made Tutela Medico-Legale look unevaluated even when chat had consent/docs.
  const adjustedScoresForTotal =
    fatalErrors.length > 0 ? { ...scores, legal: Math.min(scores.legal, 0) } : scores;

  const rawTotal = computeTotalScoreTrentesimi(scores);
  const cappedRaw = computeTotalScoreTrentesimi(adjustedScoresForTotal);
  const finalTotal = applyKillerSwitch(cappedRaw, fatalErrors);
  return {
    rawTotal,
    finalTotal,
    killerSwitchApplied: fatalErrors.length > 0 && finalTotal < rawTotal,
    adjustedScoresForTotal,
    scoresForPersist,
  };
}

export { computeTotalScoreTrentesimi };
