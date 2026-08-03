import { normalizeStepId } from "@/lib/cases/simulation-time";
import type { SessionMilestoneSnapshot } from "@/lib/simulator/milestone-tracker";
import type { InappropriateActionItem } from "@/lib/services/evaluation-scoring";
import type { DimensionScores, ScoreBreakdown } from "@/lib/services/evaluation-scoring";

const INAPPROPRIATE_EXAM_PENALTY_PERCENT = 15;

/** Milestone clinici attesi oltre al Gold Standard per caso. */
const BASELINE_CLINICAL_MILESTONES = [
  "anamnesi_completa",
  "esame_obiettivo",
  "diagnosi_differenziale",
  "piano_terapeutico",
] as const;

/** Sicurezza del paziente: allergie, farmaci, parametri/esame obiettivo. */
const PATIENT_SAFETY_MILESTONES = [
  "indagate_allergie",
  "anamnesi_farmaci",
  "esame_obiettivo",
] as const;

/** Parametri vitali / monitoraggio (almeno uno richiesto). */
const VITALS_EXAM_MILESTONE_PREFIXES = [
  "richiesto_ecg",
  "richiesto_emogas",
  "richiesto_parametri",
] as const;

/** Comunicazione ed empatia. */
const EMPATHY_MILESTONES = ["ascolto_attivo", "comunicazione_empatica"] as const;

/** Esami di III livello / alta invasività senza indicazione. */
const TIER3_EXAM_MILESTONE_KEYS = new Set([
  "richiesto_tc_encefalo",
  "richiesto_tc_torace",
  "richiesto_tc_addome",
  "richiesto_cateterismo",
  "richiesto_rm_encefalo",
]);

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function slugifyGoldStep(step: string): string {
  return normalizeStepId(step).replace(/[^a-z0-9]+/g, "_");
}

function milestoneKeySet(milestones: SessionMilestoneSnapshot[]): Set<string> {
  return new Set(milestones.map((m) => m.milestoneKey));
}

function hasMilestone(keys: Set<string>, key: string): boolean {
  if (keys.has(key)) return true;
  return [...keys].some((k) => k.includes(key) || key.includes(k));
}

function hasVitalsOrMonitoring(keys: Set<string>): boolean {
  return (
    hasMilestone(keys, "esame_obiettivo") ||
    [...keys].some((k) =>
      VITALS_EXAM_MILESTONE_PREFIXES.some((prefix) => k.startsWith(prefix)),
    )
  );
}

export type MilestoneScoreInput = {
  milestones: SessionMilestoneSnapshot[];
  goldStandardPath?: string[];
  inappropriateActions: InappropriateActionItem[];
  exams: Array<{ id: string; name: string }>;
  totalCostEuro: number;
  budgetEuro: number;
  diagnosisSemanticallyCorrect?: boolean;
};

export type MilestoneScoreBreakdown = {
  clinical: {
    expected: number;
    met: number;
    ratePercent: number;
    final: number;
    goldStepsExpected: number;
    goldStepsMet: number;
  };
  safety: {
    expected: number;
    met: number;
    vitalsMet: boolean;
    final: number;
  };
  appropriateness: {
    base: number;
    inappropriateCount: number;
    tier3WithoutIndication: number;
    penaltyPercent: number;
    final: number;
  };
  empathy: {
    expected: number;
    met: number;
    final: number;
  };
  economy: ScoreBreakdown["economy"];
};

/**
 * Accuratezza clinica (30%): % milestone diagnostico-terapeutici d'oro sbloccati.
 */
export function computeClinicalAccuracyFromMilestones(
  milestones: SessionMilestoneSnapshot[],
  goldStandardPath?: string[],
): { score: number; breakdown: MilestoneScoreBreakdown["clinical"] } {
  const keys = milestoneKeySet(milestones);

  let expectedKeys: string[] = [];
  if (goldStandardPath?.length) {
    expectedKeys = goldStandardPath.map((s) => `gold_standard_${slugifyGoldStep(s)}`);
  }

  const goldMet = expectedKeys.filter((k) => hasMilestone(keys, k)).length;
  const baselineMet = BASELINE_CLINICAL_MILESTONES.filter((k) => hasMilestone(keys, k)).length;

  const goldExpected = expectedKeys.length;
  const baselineExpected = BASELINE_CLINICAL_MILESTONES.length;

  let rate: number;
  if (goldExpected > 0) {
    const goldRate = goldMet / goldExpected;
    const baselineRate = baselineMet / baselineExpected;
    rate = goldRate * 0.75 + baselineRate * 0.25;
  } else {
    rate = baselineMet / baselineExpected;
  }

  const final = clampScore(rate * 100);

  return {
    score: final,
    breakdown: {
      expected: goldExpected + baselineExpected,
      met: goldMet + baselineMet,
      ratePercent: final,
      final,
      goldStepsExpected: goldExpected,
      goldStepsMet: goldMet,
    },
  };
}

/**
 * Sicurezza del paziente (30%): allergie, anamnesi farmacologica, parametri vitali.
 */
export function computePatientSafetyFromMilestones(
  milestones: SessionMilestoneSnapshot[],
): { score: number; breakdown: MilestoneScoreBreakdown["safety"] } {
  const keys = milestoneKeySet(milestones);
  const safetyMet = PATIENT_SAFETY_MILESTONES.filter((k) => hasMilestone(keys, k)).length;
  const vitalsMet = hasVitalsOrMonitoring(keys);

  const safetyRate = safetyMet / PATIENT_SAFETY_MILESTONES.length;
  const vitalsRate = vitalsMet ? 1 : 0;
  const combined = safetyRate * 0.7 + vitalsRate * 0.3;
  const final = clampScore(combined * 100);

  return {
    score: final,
    breakdown: {
      expected: PATIENT_SAFETY_MILESTONES.length + 1,
      met: safetyMet + (vitalsMet ? 1 : 0),
      vitalsMet,
      final,
    },
  };
}

/**
 * Appropriatezza economico-clinica (20%): 100% − 15% per indagine non indicata/ridondante.
 */
export function computeClinicalAppropriatenessScore(params: {
  inappropriateActions: InappropriateActionItem[];
  milestones: SessionMilestoneSnapshot[];
  exams: Array<{ id: string; name: string }>;
}): { score: number; breakdown: MilestoneScoreBreakdown["appropriateness"] } {
  const performedInappropriate = params.inappropriateActions.filter((a) => a.performed);
  const keys = milestoneKeySet(params.milestones);

  const hasBasicWorkup =
    hasMilestone(keys, "anamnesi_completa") || hasMilestone(keys, "esame_obiettivo");
  const tier3Requested = [...keys].filter((k) => TIER3_EXAM_MILESTONE_KEYS.has(k));
  const tier3WithoutIndication =
    hasBasicWorkup ? 0 : tier3Requested.length;

  const inappropriateCount = performedInappropriate.length + tier3WithoutIndication;
  const penaltyPercent = inappropriateCount * INAPPROPRIATE_EXAM_PENALTY_PERCENT;
  const final = clampScore(100 - penaltyPercent);

  return {
    score: final,
    breakdown: {
      base: 100,
      inappropriateCount: performedInappropriate.length,
      tier3WithoutIndication,
      penaltyPercent,
      final,
    },
  };
}

/** Comunicazione ed empatia (20%): milestone empatici sbloccati. */
export function computeEmpathyFromMilestones(
  milestones: SessionMilestoneSnapshot[],
): { score: number; breakdown: MilestoneScoreBreakdown["empathy"] } {
  const keys = milestoneKeySet(milestones);
  const met = EMPATHY_MILESTONES.filter((k) => hasMilestone(keys, k)).length;
  const final = clampScore((met / EMPATHY_MILESTONES.length) * 100);

  return {
    score: final,
    breakdown: {
      expected: EMPATHY_MILESTONES.length,
      met,
      final,
    },
  };
}

function computeEconomyIndicator(
  totalCostEuro: number,
  budgetEuro: number,
): { score: number; breakdown: ScoreBreakdown["economy"] } {
  let baseScore = 100;
  let formula = "Nessun esame a pagamento richiesto";

  if (totalCostEuro > 0) {
    if (totalCostEuro <= budgetEuro) {
      baseScore = 100;
      formula = "Costo entro budget";
    } else {
      baseScore = clampScore(100 * (budgetEuro / totalCostEuro));
      formula = `100 × (${budgetEuro} / ${totalCostEuro.toFixed(2)})`;
    }
  }

  return {
    score: baseScore,
    breakdown: {
      budgetEuro,
      totalCostEuro,
      formula,
      final: baseScore,
    },
  };
}

/**
 * Pipeline deterministica: punteggi 0–100 derivati esclusivamente da milestone + penalità oggettive.
 * `scores.exams` = appropriatezza clinica; `scores.economy` = indicatore budget (dashboard).
 */
export function deriveMilestoneDimensionScores(
  input: MilestoneScoreInput,
): {
  scores: DimensionScores;
  breakdown: ScoreBreakdown;
  milestoneBreakdown: MilestoneScoreBreakdown;
} {
  const clinical = computeClinicalAccuracyFromMilestones(
    input.milestones,
    input.goldStandardPath,
  );
  const safety = computePatientSafetyFromMilestones(input.milestones);
  const appropriateness = computeClinicalAppropriatenessScore({
    inappropriateActions: input.inappropriateActions,
    milestones: input.milestones,
    exams: input.exams,
  });
  const empathy = computeEmpathyFromMilestones(input.milestones);
  const economy = computeEconomyIndicator(input.totalCostEuro, input.budgetEuro);

  let clinicalScore = clinical.score;
  if (input.diagnosisSemanticallyCorrect === false) {
    clinicalScore = clampScore(clinicalScore * 0.65);
  }

  const scores: DimensionScores = {
    clinical: clinicalScore,
    legal: safety.score,
    exams: appropriateness.score,
    economy: economy.score,
    empathy: empathy.score,
  };

  const breakdown: ScoreBreakdown = {
    clinical: {
      base: 100,
      missedHigh: clinical.breakdown.goldStepsExpected - clinical.breakdown.goldStepsMet,
      missedMedium: BASELINE_CLINICAL_MILESTONES.length - Math.min(
        BASELINE_CLINICAL_MILESTONES.length,
        clinical.breakdown.met - clinical.breakdown.goldStepsMet,
      ),
      penaltyHigh: 100 - clinical.score,
      penaltyMedium: 0,
      final: clinicalScore,
    },
    exams: {
      base: appropriateness.breakdown.base,
      penaltySum: appropriateness.breakdown.penaltyPercent,
      performedInappropriateCount:
        appropriateness.breakdown.inappropriateCount +
        appropriateness.breakdown.tier3WithoutIndication,
      final: appropriateness.score,
    },
    economy: economy.breakdown,
    legal: {
      applicableInstruments: safety.breakdown.expected,
      violated: safety.breakdown.expected - safety.breakdown.met,
      partial: 0,
      weightPerInstrument:
        safety.breakdown.expected > 0 ? 100 / safety.breakdown.expected : 0,
      final: safety.score,
    },
    empathy: {
      baseline: 60,
      validationBonus: 0,
      transparencyBonus: 0,
      allianceBonus: 0,
      dismissalPenalty: 0,
      finalScore: empathy.score,
      final: empathy.score,
      qualitativeLabel: "Telemetria milestone (non usata per il voto comportamentale)",
      totalParameters: empathy.breakdown.expected,
      metParameters: empathy.breakdown.met,
    },
  };

  return {
    scores,
    breakdown,
    milestoneBreakdown: {
      clinical: clinical.breakdown,
      safety: safety.breakdown,
      appropriateness: appropriateness.breakdown,
      empathy: empathy.breakdown,
      economy: economy.breakdown,
    },
  };
}

/** Azzera sicurezza paziente se errore fatale (Killer Switch). */
export function applyFatalErrorToSafetyScore(scores: DimensionScores): DimensionScores {
  return { ...scores, legal: 0 };
}
