/**
 * One formula per pillar. RAG may nudge Clinica and Tutela by at most 5 points
 * when a citation is present. It cannot replace a score or lift a killer zero.
 */

import { applyEmergencySettingEmpathyPenalty } from "@/lib/reports/d-rime-engine";
import {
  DIAGNOSIS_ATTEMPT_PENALTY_POINTS,
  communicationStressPenalty,
  computeTotalScoreTrentesimi,
  type DimensionScores,
} from "@/lib/services/evaluation-scoring";

export type WaterfallKind = "base" | "blend" | "bonus" | "penalty" | "rag_adj" | "cap" | "final";

export type WaterfallStep = {
  label: string;
  delta: number;
  valueAfter: number;
  detail: string;
  kind: WaterfallKind;
};

export type ScoreWaterfall = Record<keyof DimensionScores, WaterfallStep[]>;

export type GuidelineEvidenceItem = {
  pillar: string;
  text: string;
  sources: string[];
};

const RAG_LIMIT = 5;
const LEGAL_SEVERE_CAP = 35;
const DISCHARGE_MALUS = 25;

/** Small, targeted physical-exam completeness nudge. Never a second exams score. */
export function physicalExamAdjustment(maneuverCount: number): number {
  if (maneuverCount >= 3) return 4;
  if (maneuverCount <= 0) return -4;
  return 0;
}

export function clampPillar(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function pushStep(
  steps: WaterfallStep[],
  label: string,
  before: number,
  after: number,
  kind: WaterfallKind,
  detail: string,
): number {
  const valueAfter = clampPillar(after);
  steps.push({
    label,
    delta: round1(valueAfter - before),
    valueAfter,
    detail,
    kind,
  });
  return valueAfter;
}

export function citationBacked(feedback: string | null | undefined): boolean {
  return /legge|art\.|articolo|ESC|AHA|linea guida|Gelli|219\/2017|24\/2017|choosing wisely|SNLG|protocollo/i.test(
    feedback ?? "",
  );
}

/** Difference toward the RAG score, clamped to [-5, +5]. Zero when frozen or uncited. */
export function boundedRagAdjustment(params: {
  deterministic: number;
  ragScore: number | null | undefined;
  feedback?: string | null;
  frozen: boolean;
}): number {
  if (params.frozen) return 0;
  if (params.ragScore == null || !Number.isFinite(params.ragScore)) return 0;
  if (!citationBacked(params.feedback)) return 0;
  const raw = Math.round(params.ragScore - params.deterministic);
  return Math.max(-RAG_LIMIT, Math.min(RAG_LIMIT, raw));
}

export function undoPostBlendPenalties(
  finalScore: number,
  timeMalusFraction: number,
  failedDiagnosisAttempts: number,
): number {
  let score = clampPillar(finalScore) + Math.max(0, failedDiagnosisAttempts) * DIAGNOSIS_ATTEMPT_PENALTY_POINTS;
  if (timeMalusFraction > 0 && timeMalusFraction < 1) {
    score = score / (1 - timeMalusFraction);
  }
  return clampPillar(score);
}

export type HybridScoreInput = {
  /** ESC/AHA + esame obiettivo + terapia, before time and wrong-diagnosis malus. */
  matrixClinical: number;
  clinicalAuditScore?: number | null;
  clinicalAuditEvaluable: boolean;
  timeMalusFraction: number;
  failedDiagnosisAttempts: number;
  /** Fatal allergy or Class III iatrogenic harm. Forces clinical to 0 after every other step. */
  clinicalKiller: boolean;
  legalBase: number;
  informedConsent: boolean;
  dischargeValid: boolean;
  legalSevereCap: boolean;
  appropriatenessScore: number;
  physicalExamDelta: number;
  economyScore: number;
  economyComment?: string | null;
  empathyComposite: number;
  finalStress: number | null;
  emergency?: {
    chatHistory?: Array<{ role: string; content: string }> | null;
    initialPatientStress?: number | null;
    reactivityType?: "hyper" | "hypo" | "standard" | null;
  };
  ragClinical?: { score: number; feedback: string } | null;
  ragLegal?: { score: number; feedback: string } | null;
};

export function composeHybridPillarScores(input: HybridScoreInput): {
  scores: DimensionScores;
  waterfall: ScoreWaterfall;
} {
  const clinicalSteps: WaterfallStep[] = [];
  let clinical = pushStep(
    clinicalSteps,
    "Matrice deterministica",
    0,
    input.clinicalKiller ? 0 : input.matrixClinical,
    "base",
    "ESC/AHA, completezza dell'esame obiettivo e blend terapia/posologia.",
  );
  if (!input.clinicalKiller && input.clinicalAuditEvaluable && input.clinicalAuditScore != null) {
    clinical = pushStep(
      clinicalSteps,
      "Blend audit clinico",
      clinical,
      clinical * 0.6 + input.clinicalAuditScore * 0.4,
      "blend",
      "60% motore deterministico, 40% qualità di anamnesi, differenziale, referti e diario.",
    );
  } else if (!input.clinicalKiller) {
    clinical = pushStep(
      clinicalSteps,
      "Audit clinico non valutabile",
      clinical,
      clinical,
      "blend",
      "Il pilastro resta al 100% sul motore deterministico.",
    );
  }
  const clinicalAdj = boundedRagAdjustment({
    deterministic: clinical,
    ragScore: input.ragClinical?.score,
    feedback: input.ragClinical?.feedback,
    frozen: input.clinicalKiller || clinical === 0,
  });
  clinical = pushStep(
    clinicalSteps,
    "Verifica linee guida",
    clinical,
    clinical + clinicalAdj,
    "rag_adj",
    clinicalAdj === 0
      ? "Nessun aggiustamento: manca una citazione, oppure un killer blocca il rialzo."
      : `Aggiustamento citato ${clinicalAdj > 0 ? "+" : ""}${clinicalAdj} (limite ±5).`,
  );
  if (input.timeMalusFraction > 0) {
    clinical = pushStep(
      clinicalSteps,
      "Malus tempo",
      clinical,
      clinical * (1 - input.timeMalusFraction),
      "penalty",
      `Decurtazione ${(Math.round(input.timeMalusFraction * 1000) / 10).toString()}% sul tempo di gestione.`,
    );
  }
  const diagnosisMalus = Math.max(0, input.failedDiagnosisAttempts) * DIAGNOSIS_ATTEMPT_PENALTY_POINTS;
  if (diagnosisMalus > 0) {
    clinical = pushStep(
      clinicalSteps,
      "Diagnosi errate",
      clinical,
      clinical - diagnosisMalus,
      "penalty",
      `−${DIAGNOSIS_ATTEMPT_PENALTY_POINTS} per ciascuno dei ${input.failedDiagnosisAttempts} tentativi errati.`,
    );
  }
  if (input.clinicalKiller) {
    clinical = pushStep(
      clinicalSteps,
      "Killer clinico",
      clinical,
      0,
      "cap",
      "Allergia fatale o danno iatrogeno di Classe III: voto clinico 0.",
    );
  }

  const legalSteps: WaterfallStep[] = [];
  let legal = pushStep(
    legalSteps,
    "Audit CTU",
    0,
    input.legalBase,
    "base",
    "Punteggio graduato dell'audit medico-legale, ancorato ai fatti registrati sul server.",
  );
  legal = pushStep(
    legalSteps,
    "Consenso informato",
    legal,
    legal,
    input.informedConsent ? "bonus" : "penalty",
    input.informedConsent
      ? "Consenso registrato: penalità di consenso azzerata."
      : "Consenso non registrato: la penalità resta dentro l'audit CTU.",
  );
  if (!input.dischargeValid) {
    legal = pushStep(
      legalSteps,
      "Diario di dimissione",
      legal,
      legal - DISCHARGE_MALUS,
      "penalty",
      "Diario assente o più corto di 15 caratteri.",
    );
  }
  const legalRag = boundedRagAdjustment({
    deterministic: legal,
    ragScore: input.ragLegal?.score,
    feedback: input.ragLegal?.feedback,
    frozen: input.legalSevereCap && legal === 0,
  });
  legal = pushStep(
    legalSteps,
    "Verifica linee guida",
    legal,
    legal + legalRag,
    "rag_adj",
    legalRag === 0
      ? "Nessun aggiustamento senza citazione concreta."
      : `Aggiustamento citato ${legalRag > 0 ? "+" : ""}${legalRag} (limite ±5).`,
  );
  if (input.legalSevereCap) {
    legal = pushStep(
      legalSteps,
      "Tetto medico-legale",
      legal,
      Math.min(legal, LEGAL_SEVERE_CAP),
      "cap",
      "Omissione salvavita o allergia fatale: tutela non oltre 35/100.",
    );
  }

  const examSteps: WaterfallStep[] = [];
  let exams = pushStep(
    examSteps,
    "Appropriatezza diagnostica",
    0,
    input.appropriatenessScore,
    "base",
    "Copertura degli esami di I livello e penalità per esami incongrui, ridondanti o controindicati.",
  );
  if (input.physicalExamDelta !== 0) {
    exams = pushStep(
      examSteps,
      "Esame obiettivo",
      exams,
      exams + input.physicalExamDelta,
      input.physicalExamDelta > 0 ? "bonus" : "penalty",
      "Aggiustamento mirato sulla completezza delle manovre pertinenti.",
    );
  }

  const economySteps: WaterfallStep[] = [];
  let economy = pushStep(
    economySteps,
    "Sostenibilità SSN",
    0,
    input.economyScore,
    "base",
    "Spesa reale di esami e farmaci rispetto alla spesa ideale, spreco, omissioni e budget.",
  );
  economy = pushStep(
    economySteps,
    "Commento audit economico",
    economy,
    economy,
    "blend",
    input.economyComment?.trim() ||
      "Il commento LLM descrive sprechi e omissioni e non sostituisce il punteggio deterministico.",
  );

  const empathySteps: WaterfallStep[] = [];
  let empathy = pushStep(
    empathySteps,
    "D-RIME",
    0,
    input.empathyComposite,
    "base",
    "Punteggio relazionale composito, già con i tetti per empatia formulaica o OPTION non elicitata.",
  );
  const stress = communicationStressPenalty(input.finalStress);
  empathy = pushStep(
    empathySteps,
    "Stress del paziente",
    empathy,
    empathy - stress.stressPenalty,
    "penalty",
    stress.criticalPatientStress
      ? `Stress finale ${stress.finalStressLevel} ≥ 80: −${stress.stressPenalty}.`
      : stress.stressPenalty > 0
        ? `Stress finale ${stress.finalStressLevel}: −${stress.stressPenalty}.`
        : "Stress sotto la soglia di penalità.",
  );
  const emergency = applyEmergencySettingEmpathyPenalty({
    score: empathy,
    chatHistory: input.emergency?.chatHistory,
    initialPatientStress: input.emergency?.initialPatientStress,
    reactivityType: input.emergency?.reactivityType,
  });
  if (emergency.penalized) {
    empathy = pushStep(
      empathySteps,
      "Setting di emergenza",
      empathy,
      emergency.score,
      "cap",
      emergency.reason ?? "Penalità di presa in carico tardiva in emergenza.",
    );
  }

  const scores: DimensionScores = { clinical, legal, exams, economy, empathy };
  return {
    scores,
    waterfall: {
      clinical: clinicalSteps,
      legal: legalSteps,
      exams: examSteps,
      economy: economySteps,
      empathy: empathySteps,
    },
  };
}

/** After killer switch and the non-compensatory cap, the last step equals the saved score. */
export function stampWaterfallFinals(waterfall: ScoreWaterfall, scores: DimensionScores): ScoreWaterfall {
  const next = { ...waterfall };
  (Object.keys(scores) as Array<keyof DimensionScores>).forEach((key) => {
    const steps = [...(waterfall[key] ?? [])];
    const previous = steps.length > 0 ? steps[steps.length - 1].valueAfter : 0;
    const saved = clampPillar(scores[key]);
    if (saved !== previous) {
      steps.push({
        label: "Sbarramento finale",
        delta: round1(saved - previous),
        valueAfter: saved,
        detail: "Killer switch o tetto non compensatorio sui cinque punteggi unificati.",
        kind: "cap",
      });
    }
    steps.push({
      label: "Voto finale",
      delta: 0,
      valueAfter: saved,
      detail: `${saved}/100 salvati nel pilastro.`,
      kind: "final",
    });
    next[key] = steps;
  });
  return next;
}

export function waterfallFinals(waterfall: ScoreWaterfall): DimensionScores {
  const read = (key: keyof DimensionScores) => {
    const steps = waterfall[key] ?? [];
    const final = [...steps].reverse().find((step) => step.kind === "final") ?? steps[steps.length - 1];
    return clampPillar(final?.valueAfter ?? 0);
  };
  return {
    clinical: read("clinical"),
    legal: read("legal"),
    exams: read("exams"),
    economy: read("economy"),
    empathy: read("empathy"),
  };
}

export function contributionsMatchTotal(scores: DimensionScores): {
  total: number;
  sum: number;
} {
  const total = computeTotalScoreTrentesimi(scores);
  return { total, sum: total };
}

export function buildGuidelineEvidence(rag: {
  sourceTitles?: string[];
  clinica?: { feedback?: string };
  legale?: { feedback?: string };
  economia?: { feedback?: string };
  empatia?: { feedback?: string };
} | null): GuidelineEvidenceItem[] {
  if (!rag) return [];
  const sources = rag.sourceTitles ?? [];
  return [
    { pillar: "Clinica", text: rag.clinica?.feedback ?? "", sources },
    { pillar: "Tutela", text: rag.legale?.feedback ?? "", sources },
    { pillar: "Economia", text: rag.economia?.feedback ?? "", sources },
    { pillar: "Empatia", text: rag.empatia?.feedback ?? "", sources },
  ].filter((item) => item.text.trim().length > 0);
}
