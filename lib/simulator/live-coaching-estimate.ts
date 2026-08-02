/**
 * Live in-session coaching estimates aligned to official MACRO_AREA_WEIGHTS.
 * Heuristic / didactic only — not a substitute for the post-session evaluation engine.
 *
 * STATE_INITIAL (Minuto 0 / no user events): score is null; bars use scientific baseline.
 */

import {
  MACRO_AREA_WEIGHTS,
  computeTotalScoreTrentesimi,
  type DimensionScores,
} from "@/lib/services/evaluation-scoring";
import { normalizeStepId } from "@/lib/cases/simulation-time";
import type { DemoVitalsLike } from "@/lib/clinical/vital-status";
import { classifyVitals, maxVitalStatus } from "@/lib/clinical/vital-status";

export type LiveCoachingMetricTone = "good" | "warn" | "risk";

export type LiveCoachingMetric = {
  id: "clinical" | "legal" | "exams" | "empathy";
  label: string;
  value: number;
  tone: LiveCoachingMetricTone;
  /** Short clinical status under the bar (baseline / alert states). */
  statusLabel?: string;
};

export type LiveCoachingEstimate = {
  /**
   * Weighted composite 0–100 after first interaction.
   * `null` at Minuto 0 — UI must show "--" / "INIZIO SIMULAZIONE".
   */
  scorePercent: number | null;
  /** Official-scale equivalent; null while baseline. */
  scoreTrentesimi: number | null;
  /** True when no chat / exams / findings yet. */
  isBaseline: boolean;
  metrics: LiveCoachingMetric[];
  tip: string;
  unstable: boolean;
};

export type LiveCoachingInput = {
  userMessages: string[];
  selectedExamIds: string[];
  examFindingIds: string[];
  hasObjectiveExamActivity: boolean;
  hasAnamnesisDraft: boolean;
  patientStress: number;
  vitals: DemoVitalsLike;
  goldStandardPath?: string[] | null;
  /** Explicit Minuto-0 gate from SimulatorClient when provided. */
  hasUserInteracted?: boolean;
};

const STABILIZATION_EXAM_KEYS = [
  "ecg",
  "ega",
  "emogas",
  "spo2",
  "ossigeno",
  "o2",
  "sat",
  "monitoraggio",
  "troponina",
  "troponina-hs",
  "rx-torace",
  "tc",
];

const EMPATHY_MESSAGE_RE =
  /capisco|comprendo|mi dica|racconti|come si sente|tranquill|non si preoccup|ci pensiamo|rassicur|sono qui|la aiut|insieme|scusi|mi dispiace/i;

function clampScore(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function toneFor(value: number, warnAt = 55, riskAt = 40): LiveCoachingMetricTone {
  if (value < riskAt) return "risk";
  if (value < warnAt) return "warn";
  return "good";
}

function isPhysiologicallyUnstable(vitals: DemoVitalsLike): boolean {
  const classified = classifyVitals(vitals);
  const overallVital = maxVitalStatus(classified.map((v) => v.status));
  return vitals.spo2 < 90 || vitals.hr > 110 || overallVital === "critical";
}

function isBorderlineUnstable(vitals: DemoVitalsLike): boolean {
  if (isPhysiologicallyUnstable(vitals)) return false;
  const classified = classifyVitals(vitals);
  return maxVitalStatus(classified.map((v) => v.status)) === "borderline";
}

function hasStabilizationAction(examIds: string[]): boolean {
  return examIds.some((id) => {
    const key = normalizeStepId(id);
    return STABILIZATION_EXAM_KEYS.some(
      (s) => key === s || key.includes(s) || s.includes(key),
    );
  });
}

function goldStepsTouched(
  goldStandardPath: string[] | null | undefined,
  selectedExamIds: string[],
  examFindingIds: string[],
): { met: number; expected: number } {
  const gold = (goldStandardPath ?? [])
    .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
    .map(normalizeStepId);
  if (gold.length === 0) {
    return { met: 0, expected: 0 };
  }
  const done = new Set(
    [...selectedExamIds, ...examFindingIds].map((id) => normalizeStepId(id)),
  );
  let met = 0;
  for (const step of gold) {
    const hit = [...done].some(
      (d) => d === step || d.includes(step) || step.includes(d),
    );
    if (hit) met += 1;
  }
  return { met, expected: gold.length };
}

/** Scientific baseline at session open — no fabricated composite score. */
function buildBaselineEstimate(input: LiveCoachingInput): LiveCoachingEstimate {
  const stress = Math.max(0, Math.min(100, input.patientStress));
  const physiologicallyUnstable = isPhysiologicallyUnstable(input.vitals);
  const borderlineUnstable = isBorderlineUnstable(input.vitals);
  const unstable = physiologicallyUnstable || borderlineUnstable;

  const clinical = 0;
  const exams = 100;
  const empathy = Math.max(0, 100 - stress);
  const legal = physiologicallyUnstable ? 40 : 100;

  return {
    scorePercent: null,
    scoreTrentesimi: null,
    isBaseline: true,
    unstable,
    tip: physiologicallyUnstable
      ? "Paziente instabile: valuta subito ABC e saturazione prima di approfondire l’anamnesi."
      : "Inizia l'anamnesi mirata o l'esame obiettivo.",
    metrics: [
      {
        id: "clinical",
        label: "Clinica",
        value: clinical,
        tone: "warn",
        statusLabel: "In attesa anamnesi",
      },
      {
        id: "legal",
        label: "Sicurezza/ABC",
        value: legal,
        tone: physiologicallyUnstable ? "risk" : "good",
        statusLabel: physiologicallyUnstable
          ? "Risk/Alert: da stabilizzare"
          : "ABC ok · stabile",
      },
      {
        id: "exams",
        label: "Esami",
        value: exams,
        tone: "good",
        statusLabel: "Nessuna prematurità",
      },
      {
        id: "empathy",
        label: "Empatia",
        value: clampScore(empathy),
        tone: toneFor(empathy),
        statusLabel: "Baseline triage",
      },
    ],
  };
}

/**
 * Estimates the four official macro-areas for live coaching UI.
 */
export function estimateLiveCoaching(input: LiveCoachingInput): LiveCoachingEstimate {
  const chatTurns = input.userMessages.length;
  const examCount = input.selectedExamIds.length;
  const findingCount = input.examFindingIds.length;

  const hasUserInteracted =
    input.hasUserInteracted ??
    (chatTurns > 0 || examCount > 0 || findingCount > 0);

  if (!hasUserInteracted) {
    return buildBaselineEstimate(input);
  }

  const anamnesisReady = chatTurns >= 2;
  const physiologicallyUnstable = isPhysiologicallyUnstable(input.vitals);
  const borderlineUnstable = isBorderlineUnstable(input.vitals);
  const unstable = physiologicallyUnstable || borderlineUnstable;
  const stabilized = hasStabilizationAction(input.selectedExamIds);
  const gold = goldStepsTouched(
    input.goldStandardPath,
    input.selectedExamIds,
    input.examFindingIds,
  );
  const stress = Math.max(0, Math.min(100, input.patientStress));

  // 1) Accuratezza Clinica — anamnesi + EO + gold/milestones
  let clinical = 18;
  clinical += Math.min(36, chatTurns * 9);
  if (input.hasObjectiveExamActivity || findingCount > 0) clinical += 14;
  if (input.hasAnamnesisDraft) clinical += 10;
  if (gold.expected > 0) {
    clinical += Math.round((gold.met / gold.expected) * 22);
  } else {
    clinical += Math.min(16, examCount * 4);
  }
  clinical = clampScore(clinical);

  // 2) Sicurezza & Legal (ABC)
  let legal: number;
  if (physiologicallyUnstable && !stabilized) {
    legal = 40;
  } else if (physiologicallyUnstable && stabilized) {
    legal = 72 + Math.min(18, chatTurns * 3);
  } else if (borderlineUnstable && !stabilized) {
    legal = 55;
  } else if (borderlineUnstable && stabilized) {
    legal = 78;
  } else {
    legal = 70 + Math.min(20, chatTurns * 4);
    if (stabilized) legal += 6;
  }
  if (input.userMessages.some((m) => /consenso|informat|rischi|alternativa/i.test(m))) {
    legal += 8;
  }
  legal = clampScore(legal);

  // 3) Appropriatezza Esami
  let exams = 68;
  if (!anamnesisReady && examCount > 0) {
    exams -= Math.min(40, examCount * 12);
  }
  if (anamnesisReady) {
    exams = 58 + Math.min(28, examCount * 7);
    if (examCount > 4) exams -= (examCount - 4) * 8;
  } else if (examCount === 0) {
    exams = 72;
  }
  if (gold.expected > 0 && gold.met > 0) {
    exams += Math.round((gold.met / gold.expected) * 12);
  }
  exams = clampScore(exams);

  // 4) Empatia & Comunicazione
  const empathyHits = input.userMessages.filter((m) => EMPATHY_MESSAGE_RE.test(m)).length;
  let empathy = 100 - stress;
  empathy += Math.min(12, chatTurns * 3);
  empathy += Math.min(14, empathyHits * 7);
  if (physiologicallyUnstable && chatTurns > 0 && empathyHits === 0) {
    empathy -= 10;
  }
  empathy = clampScore(empathy);

  const scores: DimensionScores = {
    clinical,
    legal,
    exams,
    economy: 50,
    empathy,
  };

  const scoreTrentesimi = computeTotalScoreTrentesimi(scores);
  const scorePercent = clampScore(
    clinical * MACRO_AREA_WEIGHTS.clinicalDiagnostic +
      legal * MACRO_AREA_WEIGHTS.legalCompliance +
      exams * MACRO_AREA_WEIGHTS.examAppropriateness +
      empathy * MACRO_AREA_WEIGHTS.empathy,
  );

  let tip: string;
  if (physiologicallyUnstable && !stabilized) {
    tip =
      "Paziente instabile: valuta subito ABC e saturazione (SpO₂ / FC) prima di approfondire l’anamnesi.";
  } else if (physiologicallyUnstable && stabilized) {
    tip =
      "Stabilizzazione avviata: completa anamnesi mirata e documenta il nesso clinico nel referto.";
  } else if (chatTurns < 2) {
    tip =
      "Inizia con un’anamnesi mirata sul motivo di accesso, i fattori di rischio e i red flag.";
  } else if (!anamnesisReady && examCount >= 3) {
    tip =
      "Hai già richiesto diversi esami: completa prima i dati anamnestici essenziali (appropriatezza).";
  } else if (examCount === 0) {
    tip =
      "Dopo l’anamnesi essenziale, considera gli esami di primo livello coerenti col sospetto clinico.";
  } else if (stress >= 70) {
    tip =
      "Stress elevato: usa un tono empatico, spiega i passi successivi e rassicura il paziente.";
  } else {
    tip =
      "Monitora Clinica · Sicurezza/ABC · Esami · Empatia; chiudi con il referto di dimissione quando il quadro è completo.";
  }

  return {
    scorePercent,
    scoreTrentesimi,
    isBaseline: false,
    unstable,
    tip,
    metrics: [
      {
        id: "clinical",
        label: "Clinica",
        value: clinical,
        tone: toneFor(clinical),
        statusLabel: clinical < 30 ? "Progressione anamnestica" : undefined,
      },
      {
        id: "legal",
        label: "Sicurezza/ABC",
        value: legal,
        tone: physiologicallyUnstable && !stabilized ? "risk" : toneFor(legal, 60, 45),
        statusLabel:
          physiologicallyUnstable && !stabilized
            ? "Risk/Alert: da stabilizzare"
            : undefined,
      },
      {
        id: "exams",
        label: "Esami",
        value: exams,
        tone: toneFor(exams),
        statusLabel: !anamnesisReady && examCount > 3 ? "Prematurità prescrittiva" : undefined,
      },
      {
        id: "empathy",
        label: "Empatia",
        value: empathy,
        tone: toneFor(empathy),
      },
    ],
  };
}
