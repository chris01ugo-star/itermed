import { normalizeStepId } from "@/lib/cases/simulation-time";
import type { SessionMilestoneSnapshot } from "@/lib/simulator/milestone-tracker";
import type { InappropriateActionItem } from "@/lib/services/evaluation-scoring";
import {
  INCONGRUENT_EXAM_PENALTY_PERCENT,
  LEGAL_SOURCE_REFS,
  motivation,
  type DimensionScores,
  type ScoreBreakdown,
  type ScoreMotivation,
} from "@/lib/services/evaluation-scoring";

const INAPPROPRIATE_EXAM_PENALTY_PERCENT = INCONGRUENT_EXAM_PENALTY_PERCENT;

const BASELINE_CLINICAL_MILESTONES = [
  "anamnesi_completa",
  "esame_obiettivo",
  "diagnosi_differenziale",
  "piano_terapeutico",
] as const;

const PATIENT_SAFETY_MILESTONES = [
  "indagate_allergie",
  "anamnesi_farmaci",
  "esame_obiettivo",
] as const;

const VITALS_EXAM_MILESTONE_PREFIXES = [
  "richiesto_ecg",
  "richiesto_emogas",
  "richiesto_parametri",
] as const;

const EMPATHY_MILESTONES = ["ascolto_attivo", "comunicazione_empatica"] as const;

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
    motivations?: ScoreMotivation[];
  };
  empathy: {
    expected: number;
    met: number;
    final: number;
  };
  economy: ScoreBreakdown["economy"];
};

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
    rate = (goldMet / goldExpected) * 0.75 + (baselineMet / baselineExpected) * 0.25;
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
  const tier3WithoutIndication = hasBasicWorkup ? 0 : tier3Requested.length;

  const examCount = Math.max(params.exams.length, 1);
  const appropriateCount = Math.max(0, params.exams.length - performedInappropriate.length);
  let score =
    params.exams.length > 0 ? (appropriateCount / examCount) * 100 : 0;

  const penaltyPercent =
    (performedInappropriate.length + tier3WithoutIndication) * INAPPROPRIATE_EXAM_PENALTY_PERCENT;
  score = clampScore(score - tier3WithoutIndication * INAPPROPRIATE_EXAM_PENALTY_PERCENT);

  const motivations: ScoreMotivation[] = [
    motivation(
      "neutral",
      `Copertura prescrittiva milestone: ${appropriateCount}/${params.exams.length || 0} esami non incongruenti`,
      {
        id: "ms_exam_cov",
        scoreImpact: Math.round(score),
        sourceRef: LEGAL_SOURCE_REFS.protocollo,
      },
    ),
  ];
  if (performedInappropriate.length > 0) {
    motivations.push(
      motivation(
        "negative",
        `${performedInappropriate.length} esami incongruenti (−${INAPPROPRIATE_EXAM_PENALTY_PERCENT}% cad.)`,
        {
          id: "ms_exam_incong",
          scoreImpact: -(performedInappropriate.length * INAPPROPRIATE_EXAM_PENALTY_PERCENT),
          sourceRef: LEGAL_SOURCE_REFS.protocollo,
        },
      ),
    );
  }
  if (tier3WithoutIndication > 0) {
    motivations.push(
      motivation(
        "negative",
        `${tier3WithoutIndication} esami III livello senza anamnesi/EO preliminare`,
        {
          id: "ms_exam_t3",
          scoreImpact: -(tier3WithoutIndication * INAPPROPRIATE_EXAM_PENALTY_PERCENT),
          sourceRef: LEGAL_SOURCE_REFS.protocollo,
        },
      ),
    );
  }

  const final = clampScore(score);

  return {
    score: final,
    breakdown: {
      base: 0,
      inappropriateCount: performedInappropriate.length,
      tier3WithoutIndication,
      penaltyPercent,
      final,
      motivations,
    },
  };
}

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
  const motivations: ScoreMotivation[] = [];
  let score = 0;
  let formula = "Analitico milestone budget";

  if (totalCostEuro > 0 && totalCostEuro <= budgetEuro) {
    score = 70;
    formula = "Costo entro budget";
    motivations.push(
      motivation(
        "positive",
        `Spesa €${totalCostEuro.toFixed(0)} entro budget €${budgetEuro}`,
        { id: "ms_eco_ok", scoreImpact: 70, sourceRef: LEGAL_SOURCE_REFS.nomenclatore },
      ),
    );
  } else if (totalCostEuro > budgetEuro) {
    score = clampScore(70 * (budgetEuro / totalCostEuro));
    formula = `Sforamento €${totalCostEuro.toFixed(0)} / €${budgetEuro}`;
    motivations.push(
      motivation(
        "negative",
        `Sforamento — €${totalCostEuro.toFixed(0)} su budget €${budgetEuro}`,
        {
          id: "ms_eco_over",
          scoreImpact: score - 70,
          sourceRef: LEGAL_SOURCE_REFS.nomenclatore,
        },
      ),
    );
  } else {
    motivations.push(
      motivation("neutral", "Nessuna spesa SSN — punteggio economico 0", {
        id: "ms_eco_zero",
        scoreImpact: 0,
        sourceRef: LEGAL_SOURCE_REFS.nomenclatore,
      }),
    );
  }

  return {
    score,
    breakdown: {
      budgetEuro,
      totalCostEuro,
      formula,
      final: score,
      motivations,
    },
  };
}

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

  const safetyFullyMet =
    safety.breakdown.met >= safety.breakdown.expected && safety.breakdown.vitalsMet;
  const legalScore = safetyFullyMet ? 100 : 0;
  const conformityStatus = safetyFullyMet ? ("CONFORME" as const) : ("NON_CONFORME" as const);

  const scores: DimensionScores = {
    clinical: clinicalScore,
    legal: legalScore,
    exams: appropriateness.score,
    economy: economy.score,
    empathy: empathy.score,
  };

  const breakdown: ScoreBreakdown = {
    clinical: {
      base: 0,
      missedHigh: clinical.breakdown.goldStepsExpected - clinical.breakdown.goldStepsMet,
      missedMedium:
        BASELINE_CLINICAL_MILESTONES.length -
        Math.min(
          BASELINE_CLINICAL_MILESTONES.length,
          clinical.breakdown.met - clinical.breakdown.goldStepsMet,
        ),
      penaltyHigh: 0,
      penaltyMedium: 0,
      final: clinicalScore,
      motivations: [
        motivation(
          "neutral",
          `Milestone clinici: ${clinical.breakdown.met}/${clinical.breakdown.expected} (gold ${clinical.breakdown.goldStepsMet}/${clinical.breakdown.goldStepsExpected}) = ${clinicalScore}/100`,
          {
            id: "ms_clin",
            scoreImpact: clinicalScore,
            sourceRef: LEGAL_SOURCE_REFS.protocollo,
          },
        ),
      ],
    },
    exams: {
      base: 0,
      penaltySum: appropriateness.breakdown.penaltyPercent,
      performedInappropriateCount:
        appropriateness.breakdown.inappropriateCount +
        appropriateness.breakdown.tier3WithoutIndication,
      final: appropriateness.score,
      motivations: appropriateness.breakdown.motivations ?? [],
    },
    economy: {
      ...economy.breakdown,
      motivations: economy.breakdown.motivations ?? [],
    },
    legal: {
      applicableInstruments: safety.breakdown.expected,
      violated: safety.breakdown.expected - safety.breakdown.met,
      partial: 0,
      weightPerInstrument: 0,
      final: legalScore,
      conformityStatus,
      protectionLabel: conformityStatus,
      formalLabel: safetyFullyMet
        ? "CONFORME (TUTELATO)"
        : "NON CONFORME (RISCHIO CONTENZIOSO)",
      sourceRef: LEGAL_SOURCE_REFS.gelliArt5,
      motivations: [
        motivation(
          safetyFullyMet ? "positive" : "negative",
          `Sicurezza paziente: ${safety.breakdown.met}/${safety.breakdown.expected} (vitali: ${safety.breakdown.vitalsMet ? "sì" : "no"})`,
          {
            id: "ms_legal",
            scoreImpact: 0,
            sourceRef: LEGAL_SOURCE_REFS.gelliArt5,
          },
        ),
      ],
    },
    empathy: {
      baseline: 0,
      validationBonus: 0,
      transparencyBonus: 0,
      allianceBonus: 0,
      dismissalPenalty: 0,
      finalScore: empathy.score,
      final: empathy.score,
      qualitativeLabel: "Telemetria milestone (non usata per il voto comportamentale)",
      motivations: [
        motivation(
          "neutral",
          `Milestone empatici: ${empathy.breakdown.met}/${empathy.breakdown.expected}`,
          { id: "ms_emp", scoreImpact: empathy.score },
        ),
      ],
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

export function applyFatalErrorToSafetyScore(scores: DimensionScores): DimensionScores {
  return { ...scores, legal: 0 };
}
