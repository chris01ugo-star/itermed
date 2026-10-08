import type { CaseDifficulty } from "@prisma/client";
import type { ExamClinicalMeta } from "@/lib/exam-default-values";
import type { AnamnesisQuestion, CaseExamDefinition } from "@/lib/data/cases/types";
import type { ExamPayload } from "@/lib/services/evaluation-service";
import {
  computeCalgaryCambridgeEmpathy,
  EMPATHY_RAG_REFS,
  resolveClinicalUrgencyMode,
  type ClinicalUrgencyMode,
} from "@/lib/services/evaluation-empathy-calgary";
import type {
  DRimeTrajectoryStep,
  PatientStateVector,
} from "@/lib/reports/d-rime-engine";
import {
  buildExecutedActionIds,
  computeEscAhaClinicalAccuracy,
  isActionIdExecuted,
  CLINICAL_RAG_REFS,
} from "@/lib/services/evaluation-clinical-esc";
import {
  computeLegalRagConformity,
  type LegalRagFinding,
} from "@/lib/services/evaluation-legal-rag";
import {
  computeEconomySsnScore,
  computeEfficiencyPercent,
  computeScostamentoPercent,
  clampPercent as clampEconomyPercent,
  ECONOMY_RAG_REFS,
} from "@/lib/services/evaluation-economy-ssn";
import type { GuidelineChunk } from "@/lib/services/rag-service";
import type { SessionPrescription } from "@/lib/simulator/prescription-trace";
import {
  applyTherapyToClinicalScore,
  type TherapyEvaluation,
} from "@/lib/services/evaluation-medications";
import { detectAllergyFatalPrescriptions } from "@/lib/services/evaluation-allergies";

export {
  EMPATHY_RAG_REFS,
  resolveClinicalUrgencyMode,
  CLINICAL_RAG_REFS,
  buildExecutedActionIds,
  ECONOMY_RAG_REFS,
  computeEfficiencyPercent,
  computeScostamentoPercent,
  clampEconomyPercent,
};
export type { ClinicalUrgencyMode, LegalRagFinding };

export const CRITICAL_WEIGHT_HIGH = 2;
export const CRITICAL_WEIGHT_MEDIUM = 1;

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
  /**
   * Tutela medico-legale: mapping binario per persistenza / trentesimi.
   * CONFORME → 100, NON_CONFORME → 0. La UI non mostra questo come voto numerico.
   */
  legal: number;
  /** Appropriatezza prescrittiva degli esami (0–100). Weight 15% → max 4.5/30. */
  exams: number;
  /** Sostenibilità economica / budget SSN (0–100). Weight 10% → max 3/30. */
  economy: number;
  /** Comunicazione e relazione clinica D-RIME (0–100). Weight 15% → max 4.5/30. */
  empathy: number;
};

/**
 * Motivazione Esperti — citazione strutturata obbligatoria dove applicabile.
 */
export type ScoreMotivation = {
  id: string;
  type: "positive" | "negative" | "neutral";
  text: string;
  sourceRef?: string;
  /** Delta numerico sul punteggio della dimensione (può essere 0 per note qualitative). */
  scoreImpact: number;
};

/** Esito formale binario della valutazione giuridica. */
export type LegalConformityStatus = "CONFORME" | "NON_CONFORME";

/**
 * @deprecated Prefer LegalConformityStatus. Legacy aliases kept for persisted rawTrace.
 */
export type LegalProtectionLabel =
  | LegalConformityStatus
  | "TUTELATO"
  | "NON_TUTELATO"
  | "PARZIALMENTE_TUTELATO";

export type EmpathyBehavioralBreakdown = {
  /** Always 0 in Calgary model — kept for persisted traces. */
  baseline: number;
  validationBonus: number;
  transparencyBonus: number;
  allianceBonus: number;
  dismissalPenalty: number;
  finalScore: number;
  final: number;
  qualitativeLabel: string;
  motivations: ScoreMotivation[];
  totalParameters?: number;
  metParameters?: number;
  /** Analisi esperta (registro psicologo comportamentale / docente). */
  expertAnalysis?: string;
  framework?: "calgary-cambridge" | "d-rime";
  urgencyMode?: "acute_emergency" | "stable_exploratory" | "standard";
  dimensions?: {
    activeListening: { score: number; weight: number; label: string };
    emotionalValidation: { score: number; weight: number; label: string };
    clinicalContext: { score: number; weight: number; label: string };
  };
  /** Audit transazionale D-RIME (SPIKES / RIAS / CARE). */
  dRime?: {
    spikesEmpathyScore: number;
    riasAlignmentScore: number;
    careTrustScore: number;
    allianceScore: number;
    biasManagementScore: number;
    defensiveMedicineScore: number;
    initialState: PatientStateVector;
    finalState: PatientStateVector;
    trajectory: DRimeTrajectoryStep[];
    relationalInsights: string[];
  };
  /** Stress finale del paziente e malus applicato al D-RIME. */
  finalStressLevel?: number | null;
  stressPenalty?: number;
  criticalPatientStress?: boolean;
};

export type ScoreBreakdown = {
  clinical: {
    base: number;
    missedHigh: number;
    missedMedium: number;
    penaltyHigh: number;
    penaltyMedium: number;
    final: number;
    motivations: ScoreMotivation[];
    anamnesisCapped?: boolean;
    anamnesisCoveragePercent?: number;
    /** Azioni critiche eseguite / attese (peso). */
    earnedWeight?: number;
    totalWeight?: number;
    /** Analisi esperta — Professore di Clinica (ESC/AHA). */
    expertAnalysis?: string;
    framework?: "esc-aha-recommendation-matrix";
    qualitativeLabel?: string;
    iatrogenicCritical?: boolean;
    iatrogenicEvents?: Array<{ actionId: string; name: string; rationale: string }>;
    /** Registro immutabile — solo ID esatti. */
    executedActionIds?: string[];
    classI?: { executed: number; expected: number; omittedIds: string[]; executedIds: string[] };
    classIII?: { executed: number; expectedAvoid: number; executedIds: string[] };
    dimensions?: {
      classIAdherence: { score: number; weight: number; label: string; met: number; expected: number };
      classIIIAvoidance: { score: number; weight: number; label: string; met: number; expected: number };
      diagnosticSequencing: {
        score: number;
        weight: number;
        label: string;
        met: number;
        expected: number;
      };
      therapeuticAppropriateness?: {
        score: number;
        weight: number;
        label: string;
        met: number;
        expected: number;
      };
    };
    /** Appropriatezza del ricettario. Assente se il caso non ha una matrice terapeutica. */
    therapy?: TherapyEvaluation;
    /** Minuti simulati della sessione, se il caso ha un timeLimitMinutes. */
    elapsedMinutes?: number;
    timeLimitMinutes?: number;
    /** (elapsed − limite) / limite. Negativo o zero = dentro il tempo. */
    timeOverrunRatio?: number;
    /** Frazione sottratta al punteggio clinico: 0, lineare fino a 0.15, oppure 0.25. */
    timeMalusFraction?: number;
    /** Sforamento oltre il 50% del tempo limite. */
    criticalTimeDelay?: boolean;
    /** Diagnosi finali giudicate errate prima di quella corretta. */
    failedDiagnosisCount?: number;
    /** Punti sottratti al clinico: 10 per tentativo, prima del clamp a 0. */
    diagnosisPenalty?: number;
  };
  exams: {
    base: number;
    penaltySum: number;
    performedInappropriateCount: number;
    final: number;
    motivations: ScoreMotivation[];
    overPrescriptionCount?: number;
    goldHits?: number;
    goldExpected?: number;
  };
  economy: {
    budgetEuro: number;
    /** Spesa effettiva combinata: esami + farmaci (€). */
    totalCostEuro: number;
    /** Quota esami della spesa effettiva (€). */
    examSpendEuro?: number;
    /** Quota farmaci della spesa effettiva (€). */
    medicationSpendEuro?: number;
    formula: string;
    final: number;
    motivations: ScoreMotivation[];
    appropriatenessCouplingApplied?: boolean;
    underPrescriptionApplied?: boolean;
    overPrescriptionWasteEuro?: number;
    virtuousSpendEuro?: number;
    /** Spesa ideale Gold Standard (€). */
    idealSpendEuro?: number;
    /** Delta = effettiva − ideale (€). */
    deltaSpendEuro?: number;
    scostamentoPercent?: number;
    efficiencyPercent?: number;
    omissionEuro?: number;
    expertAnalysis?: string;
    framework?: "economy-ssn-hta";
    qualitativeLabel?: string;
    prescriptions?: {
      virtuous: Array<{ examId: string; name: string; costEuro: number; sourceRef: string }>;
      inappropriate: Array<{ examId: string; name: string; costEuro: number; sourceRef: string }>;
      omissions: Array<{ examId: string; name: string; costEuro: number; sourceRef: string }>;
    };
  };
  legal: {
    applicableInstruments: number;
    violated: number;
    partial: number;
    weightPerInstrument: number;
    /** 100 = CONFORME, 0 = NON_CONFORME (solo per persistenza/trentesimi). */
    final: number;
    motivations: ScoreMotivation[];
    ragSourcesCount?: number;
    hasLegalContext?: boolean;
    usedProntuarioFallback?: boolean;
    unevaluable?: boolean;
    /** Binary juridical outcome. */
    conformityStatus: LegalConformityStatus;
    /** @deprecated alias of conformityStatus for older UI. */
    protectionLabel?: LegalProtectionLabel;
    /** Citazione normativa principale in evidenza (dinamica dal RAG). */
    sourceRef?: string;
    formalLabel?: string;
    /** Analisi esperta — Perito Medico-Legale / CTU. */
    expertAnalysis?: string;
    framework?: "legal-rag-ctu";
    /** Rilievi deduplicati (documento + fattispecie). */
    rilievi?: LegalRagFinding[];
    criteriaResults?: Array<{
      id: string;
      description: string;
      met: boolean;
      sourceRef: string;
    }>;
  };
  empathy: EmpathyBehavioralBreakdown;
  /**
   * Stress finale e malus sul D-RIME. Stesso voto di `empathy`, con i campi di tracciamento.
   */
  communication?: {
    finalStressLevel: number | null;
    stressPenalty: number;
    criticalPatientStress: boolean;
    final: number;
  };
};

/** @deprecated Calgary model — no fictitious +60 floor. */
export const EMPATHY_PROFESSIONAL_BASELINE = 0;
/** @deprecated */
export const EMPATHY_EMPTY_CHECKLIST_BASELINE = 0;

export const INCONGRUENT_EXAM_PENALTY_PERCENT = 25;
export const CLINICAL_ANAMNESIS_SEVERITY_CAP = 15;
export const ANAMNESIS_COVERAGE_THRESHOLD = 0.2;
export const LEGAL_NON_CONFORME_SCORE = 0;
export const LEGAL_CONFORME_SCORE = 100;
/** @deprecated use LEGAL_NON_CONFORME_SCORE */
export const LEGAL_NON_TUTELATO_SCORE = LEGAL_NON_CONFORME_SCORE;
export const LEGAL_TUTELATO_SCORE = LEGAL_CONFORME_SCORE;
export const EXAMS_APPROPRIATENESS_ECONOMY_THRESHOLD = 60;
export const UNDERPRESCRIPTION_ECONOMY_PENALTY = 35;

export const PRONTUARIO_MEDICO_LEGALE_BASE_SSN = "Prontuario Medico-Legale Base SSN";
/**
 * @deprecated Citazioni legali devono arrivare dinamicamente dal corpus RAG specialty
 * (`evaluation-legal-rag.ts`). Questi riferimenti restano solo per pilastri non-legal
 * (nomenclatore / protocollo clinico) e compatibilità persistence.
 */
export const LEGAL_SOURCE_REFS = {
  gelliArt5: "Rif. Art. 5 L. 24/2017 (Gelli-Bianco)",
  consensoL219: "Rif. Art. 1 L. 219/2017 (Consenso Informato)",
  deontologia20:
    "Rif. CODICE-DEONTOLOGIA-MEDICA-2014.pdf - Art. 20 (Relazione di cura e tempo di comunicazione)",
  deontologia24:
    "Rif. CODICE-DEONTOLOGIA-MEDICA-2014.pdf - Art. 24 (Informazione e consenso del paziente)",
  deontologia33: "Rif. Art. 33 Codice Deontologico",
  deontologia35: "Rif. Art. 35 Codice Deontologico",
  prontuario: "Rif. Prontuario Medico-Legale Base SSN — sicurezza e gestione emergenze",
  nomenclatore: "Rif. Nomenclatore SSN D.M. 2017",
  protocollo: "Rif. Protocollo Clinico / Gold Standard del caso",
} as const;

export const PRONTUARIO_SOURCE_REFS = [
  LEGAL_SOURCE_REFS.gelliArt5,
  LEGAL_SOURCE_REFS.consensoL219,
  LEGAL_SOURCE_REFS.deontologia33,
] as const;

const DEFAULT_BUDGET_BY_DIFFICULTY: Record<CaseDifficulty, number> = {
  EASY: 250,
  MEDIUM: 400,
  HARD: 600,
};

const ANAMNESIS_PROTOCOL_KEYS: Array<{
  id: string;
  label: string;
  patterns: RegExp;
  milestoneHints: string[];
}> = [
  {
    id: "motivo_accesso",
    label: "Motivo di accesso / sintomo principale",
    patterns: /perch[eé]|motivo|cosa (le )?è successo|di cosa si lament|sintomo principale|che disturbo/i,
    milestoneHints: ["anamnesi_completa", "motivo_accesso"],
  },
  {
    id: "tempo_insorgenza",
    label: "Tempo di insorgenza / durata",
    patterns: /da quanto|quando (è |sono )?iniziat|da quanto tempo|da quante ore|da quanti giorni/i,
    milestoneHints: ["anamnesi_completa", "tempo_insorgenza"],
  },
  {
    id: "caratteristiche_sintomo",
    label: "Caratteristiche del sintomo",
    patterns: /dove (fa male|sente)|irradia|tipo di dolore|intensit[aà]|continuo|intermittente|scala (del )?dolore|nrs|vas/i,
    milestoneHints: ["anamnesi_completa", "caratteristiche_dolore"],
  },
  {
    id: "fattori_rischio",
    label: "Fattori di rischio / red flags",
    patterns: /fattori di rischio|fumo|diabete|ipertension|familiarit|red ?flag|allarme|sincope|sudorazione/i,
    milestoneHints: ["anamnesi_completa", "fattori_rischio"],
  },
  {
    id: "allergie",
    label: "Allergie",
    patterns: /allergi|intolleranz/i,
    milestoneHints: ["indagate_allergie", "allergie"],
  },
  {
    id: "farmaci",
    label: "Terapia in atto / anamnesi farmacologica",
    patterns: /farmaci|terapia (in atto|farmacologica)|assume|prende|pillol/i,
    milestoneHints: ["anamnesi_farmaci", "farmaci"],
  },
  {
    id: "patologie_pregresse",
    label: "Patologie pregresse / comorbidità",
    patterns: /patologie? (pregresse|note)|comorb|anamnesi patologica|ha avuto|intervent[oi]|ricover/i,
    milestoneHints: ["anamnesi_completa", "patologie_pregresse"],
  },
  {
    id: "esame_obiettivo_intent",
    label: "Esame obiettivo / parametri",
    patterns: /esame obiettivo|parametri vitali|auscult|palp|pressione|frequenza|saturazione|ecg/i,
    milestoneHints: ["esame_obiettivo", "richiesto_parametri", "richiesto_ecg"],
  },
  {
    id: "diagnosi_differenziale_intent",
    label: "Ipotesi diagnostiche / diagnosi differenziale",
    patterns: /diagnosi differenzial|ipotesi|potrebbe (essere|trattarsi)|sospetto di/i,
    milestoneHints: ["diagnosi_differenziale"],
  },
  {
    id: "piano_terapeutico_intent",
    label: "Piano terapeutico / follow-up",
    patterns: /terapia|trattamento|follow[- ]?up|ricovero|dimissione|monitoraggio/i,
    milestoneHints: ["piano_terapeutico"],
  },
];

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

/** Soglia oltre la quale il malus diventa fisso e scatta `criticalTimeDelay`. */
export const CLINICAL_TIME_LINEAR_CAP = 0.5;
/** Malus massimo nella fascia lineare (+1% … +50% del limite). */
export const CLINICAL_TIME_LINEAR_MAX_MALUS = 0.15;
/** Malus fisso oltre +50% del tempo limite. */
export const CLINICAL_TIME_CRITICAL_MALUS = 0.25;
/** Punti clinici sottratti per ogni diagnosi finale errata. */
export const DIAGNOSIS_ATTEMPT_PENALTY_POINTS = 10;
/** Sotto questa soglia lo stress del paziente non tocca la comunicazione. */
export const PATIENT_STRESS_FREE_BELOW = 50;
/** Da questa soglia lo stress è critico per la comunicazione. */
export const PATIENT_STRESS_CRITICAL_FROM = 80;
export const PATIENT_STRESS_MODERATE_PENALTY = 15;
export const PATIENT_STRESS_CRITICAL_PENALTY = 30;

/**
 * Malus sul D-RIME in funzione dello stress finale (0–100).
 * < 50 → 0; 50–79 → −15; ≥ 80 → −30 e criticalPatientStress.
 * Punteggio = max(0, arrotonda(D-RIME − penalità)).
 */
export function communicationStressPenalty(finalPatientStress: number | null | undefined): {
  finalStressLevel: number | null;
  stressPenalty: number;
  criticalPatientStress: boolean;
} {
  if (finalPatientStress == null || !Number.isFinite(finalPatientStress)) {
    return { finalStressLevel: null, stressPenalty: 0, criticalPatientStress: false };
  }
  const finalStressLevel = Math.max(0, Math.min(100, Math.round(finalPatientStress)));
  if (finalStressLevel < PATIENT_STRESS_FREE_BELOW) {
    return { finalStressLevel, stressPenalty: 0, criticalPatientStress: false };
  }
  if (finalStressLevel >= PATIENT_STRESS_CRITICAL_FROM) {
    return {
      finalStressLevel,
      stressPenalty: PATIENT_STRESS_CRITICAL_PENALTY,
      criticalPatientStress: true,
    };
  }
  return {
    finalStressLevel,
    stressPenalty: PATIENT_STRESS_MODERATE_PENALTY,
    criticalPatientStress: false,
  };
}

/**
 * Malus sul punteggio clinico in funzione dello sforamento.
 * r = (elapsed − limite) / limite
 * malus = 0                         se r ≤ 0
 *       = 0.15 × (r / 0.50)         se 0 < r ≤ 0.50
 *       = 0.25                       se r > 0.50
 * Punteggio finale = arrotonda(punteggio × (1 − malus)).
 */
export function clinicalTimeMalusFraction(
  elapsedMinutes: number,
  timeLimitMinutes: number,
): { overrunRatio: number; malusFraction: number; criticalTimeDelay: boolean } {
  if (!(timeLimitMinutes > 0) || !Number.isFinite(elapsedMinutes) || elapsedMinutes < 0) {
    return { overrunRatio: 0, malusFraction: 0, criticalTimeDelay: false };
  }
  const overrunRatio = (elapsedMinutes - timeLimitMinutes) / timeLimitMinutes;
  if (overrunRatio <= 0) {
    return { overrunRatio, malusFraction: 0, criticalTimeDelay: false };
  }
  if (overrunRatio > CLINICAL_TIME_LINEAR_CAP) {
    return {
      overrunRatio,
      malusFraction: CLINICAL_TIME_CRITICAL_MALUS,
      criticalTimeDelay: true,
    };
  }
  return {
    overrunRatio,
    malusFraction: (overrunRatio / CLINICAL_TIME_LINEAR_CAP) * CLINICAL_TIME_LINEAR_MAX_MALUS,
    criticalTimeDelay: false,
  };
}

const CONFUSIONAL_STATE_OMISSION =
  "Grave omissione: non è stato indagato lo stato confusionale del paziente";

const NEUROLOGICAL_WORKUP_PENALTY = 20;

/** Esame obiettivo neurologico, GCS o indagine affine presente nel registro azioni. */
const NEUROLOGICAL_WORKUP_PATTERN =
  /gcs|glasgow|pupils|pupille|neuro(?:-deficits|log)|deficiti?[-\s]?focal|sensorio|orientament|coscienza|encefal|eeg/;

export function hasNeurologicalWorkup(actionIds: Array<string | null | undefined>): boolean {
  return actionIds.some((raw) => {
    const id = (raw ?? "").trim().toLowerCase().replace(/_/g, "-");
    return id.length > 0 && NEUROLOGICAL_WORKUP_PATTERN.test(id);
  });
}

function applyConfusionalStateOmission(params: {
  score: number;
  breakdown: ScoreBreakdown["clinical"];
  neurologicalRedFlagDetected?: boolean;
  actionIds: Array<string | null | undefined>;
}): { score: number; breakdown: ScoreBreakdown["clinical"] } {
  if (!params.neurologicalRedFlagDetected) {
    return { score: params.score, breakdown: params.breakdown };
  }
  if (hasNeurologicalWorkup(params.actionIds)) {
    return { score: params.score, breakdown: params.breakdown };
  }
  const score = clampScore(params.score - NEUROLOGICAL_WORKUP_PENALTY);
  return {
    score,
    breakdown: {
      ...params.breakdown,
      final: score,
      expertAnalysis: params.breakdown.expertAnalysis
        ? `${params.breakdown.expertAnalysis} ${CONFUSIONAL_STATE_OMISSION}`
        : CONFUSIONAL_STATE_OMISSION,
      motivations: [
        ...(params.breakdown.motivations ?? []),
        motivation("negative", CONFUSIONAL_STATE_OMISSION, {
          id: "clin_confusional_state_omission",
          scoreImpact: -NEUROLOGICAL_WORKUP_PENALTY,
          sourceRef: LEGAL_SOURCE_REFS.protocollo,
        }),
      ],
    },
  };
}

let motivationSeq = 0;

export function motivation(
  type: ScoreMotivation["type"],
  text: string,
  opts?: { id?: string; sourceRef?: string; scoreImpact?: number },
): ScoreMotivation {
  motivationSeq += 1;
  return {
    id: opts?.id ?? `mot_${type}_${motivationSeq}`,
    type,
    text,
    scoreImpact: opts?.scoreImpact ?? 0,
    ...(opts?.sourceRef ? { sourceRef: opts.sourceRef } : {}),
  };
}

function dedupeMotivationsByText(items: ScoreMotivation[]): ScoreMotivation[] {
  const seen = new Set<string>();
  const out: ScoreMotivation[] = [];
  for (const m of items) {
    const key = `${m.type}|${(m.text ?? "").trim().toLowerCase()}|${(m.sourceRef ?? "").trim().toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(m);
  }
  return out;
}

export type CaseFatalExamRef = {
  examId: string;
  name?: string;
  finding?: string;
  isFatal?: boolean;
  componentExamIds?: string[];
};

/**
 * Killer Switch dal JSON del caso. Mandatory + isFatal e non eseguito = omissione salvavita.
 * Inappropriate + isFatal ed eseguito = azione letale. Senza `executedActionIds` non decide
 * (il fallback regex in evaluation-killer-switch resta attivo).
 */
export function collectCaseFatalErrors(params: {
  mandatoryExams?: CaseFatalExamRef[] | null;
  inappropriateExams?: CaseFatalExamRef[] | null;
  executedActionIds?: readonly string[] | null;
}): Array<{ description: string; rationale: string }> {
  if (!Array.isArray(params.executedActionIds)) return [];

  const executed = new Set(params.executedActionIds);
  const catalog = [
    ...(params.mandatoryExams ?? []),
    ...(params.inappropriateExams ?? []),
  ] as CaseExamDefinition[];

  const wasExecuted = (exam: CaseFatalExamRef): boolean => {
    if (isActionIdExecuted(exam.examId, executed, catalog)) return true;
    const id = normalizeExamSlug(exam.examId);
    const name = normalizeExamSlug(exam.name ?? "");
    for (const raw of executed) {
      const slug = normalizeExamSlug(raw);
      if (!slug) continue;
      if (slug === id) return true;
      if (name.length >= 4 && slug === name) return true;
    }
    return false;
  };

  const errors: Array<{ description: string; rationale: string }> = [];

  for (const exam of params.mandatoryExams ?? []) {
    if (exam?.isFatal !== true || wasExecuted(exam)) continue;
    const label = exam.name?.trim() || exam.examId;
    errors.push({
      description: `Omissione salvavita: ${label}`,
      rationale:
        exam.finding?.trim() ||
        "Azione obbligatoria marcata isFatal nel caso clinico e assente dal registro esecutivo.",
    });
  }

  for (const exam of params.inappropriateExams ?? []) {
    if (exam?.isFatal !== true || !wasExecuted(exam)) continue;
    const label = exam.name?.trim() || exam.examId;
    errors.push({
      description: `Azione letale eseguita: ${label}`,
      rationale:
        exam.finding?.trim() ||
        "Azione inappropriata marcata isFatal nel caso clinico ed eseguita dallo studente.",
    });
  }

  return errors;
}

export function normalizeExamSlug(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

const NON_EXAM_GOLD_STEPS = new Set([
  "consenso_informato",
  "consenso",
  "anamnesi",
  "anamnesi_completa",
  "esame_obiettivo",
  "diagnosi",
  "diagnosi_differenziale",
  "piano_terapeutico",
  "stabilizzazione",
  "abc",
]);

export function extractMandatoryFirstLevelExams(goldStandardPath?: string[] | null): string[] {
  const path = Array.isArray(goldStandardPath) ? goldStandardPath : [];
  return path
    .map((s) => normalizeExamSlug(s))
    .filter((s) => s.length > 0 && !NON_EXAM_GOLD_STEPS.has(s) && !s.includes("consenso"));
}

function examMatchesGold(
  exam: { id?: string; name?: string },
  goldSlugs: string[],
): boolean {
  const candidates = [exam.id, exam.name]
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .map(normalizeExamSlug);
  if (candidates.length === 0 || goldSlugs.length === 0) return false;
  return goldSlugs.some((g) =>
    candidates.some((c) => c.includes(g) || g.includes(c) || c === g),
  );
}

function descriptionMatchesGold(description: string, goldSlugs: string[]): boolean {
  const slug = normalizeExamSlug(description);
  return goldSlugs.some((g) => slug.includes(g) || g.includes(slug));
}

export function resolveLegalConformity(
  label?: LegalProtectionLabel | LegalConformityStatus | null,
): LegalConformityStatus {
  if (label === "CONFORME" || label === "TUTELATO") return "CONFORME";
  return "NON_CONFORME";
}

export function legalConformityFormalLabel(status: LegalConformityStatus): string {
  return status === "CONFORME"
    ? "CONFORME (Scudo Legale Attivo)"
    : "NON CONFORME (Profilo di Rischio Contenzioso)";
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
 * Copertura anamnesi = punti chiave protocollo effettivamente affrontati / attesi.
 */
export function computeAnamnesisProtocolCoverage(params: {
  chatHistory?: Array<{ role: string; content: string }> | null;
  sessionMilestones?: Array<{ milestoneKey: string }> | null;
  goldStandardPath?: string[] | null;
}): {
  coveragePercent: number;
  expected: number;
  covered: number;
  coveredLabels: string[];
  missingLabels: string[];
} {
  const chat = Array.isArray(params.chatHistory) ? params.chatHistory : [];
  const doctorText = chat
    .filter((m) => m.role === "user" && typeof m.content === "string")
    .map((m) => m.content)
    .join("\n");
  const milestoneKeys = new Set(
    (params.sessionMilestones ?? []).map((m) => m.milestoneKey).filter(Boolean),
  );

  const coveredLabels: string[] = [];
  const missingLabels: string[] = [];
  for (const key of ANAMNESIS_PROTOCOL_KEYS) {
    const chatHit = key.patterns.test(doctorText);
    const milestoneHit = key.milestoneHints.some(
      (h) =>
        milestoneKeys.has(h) ||
        [...milestoneKeys].some((k) => k.includes(h) || h.includes(k)),
    );
    if (chatHit || milestoneHit) coveredLabels.push(key.label);
    else missingLabels.push(key.label);
  }

  const expected = ANAMNESIS_PROTOCOL_KEYS.length;
  const covered = coveredLabels.length;
  const coveragePercent = expected > 0 ? Math.round((covered / expected) * 100) : 0;
  return { coveragePercent, expected, covered, coveredLabels, missingLabels };
}

/**
 * Accuratezza clinica — matrice ESC/AHA su registro `executedActionIds`.
 * Fallback legacy: checklist LLM solo se matrice caso assente.
 */
export function computeClinicalAccuracyScore(
  criticalActions: CriticalActionItem[] | null | undefined,
  options?: {
    anamnesisCoveragePercent?: number;
    caseId?: string | null;
    caseTitle?: string | null;
    executedActionIds?: string[] | null;
    requestedExamIds?: string[] | null;
    orderedExams?: Array<{ id?: string; name?: string; cost?: number }> | null;
    mandatoryExams?: CaseExamDefinition[] | null;
    inappropriateExams?: CaseExamDefinition[] | null;
    goldStandardPath?: string[] | null;
    neurologicalRedFlagDetected?: boolean;
    /** `baselineExamFindings` del caso: `therapyMatrix` canonica o `goldTherapy` legacy. */
    baselineExamFindings?: unknown;
    prescribedMedications?: SessionPrescription[] | null;
    /** Clock simulato della sessione (`CaseSession.elapsedMinutes`). */
    elapsedMinutes?: number | null;
    /** `timeLimitMinutes` del caso. Assente o ≤ 0: nessuna penalità. */
    timeLimitMinutes?: number | null;
    /** Tentativi di diagnosi finale giudicati errati (`CaseSession.failedDiagnosisAttempts`). */
    failedDiagnosisAttempts?: number | null;
  },
): {
  score: number;
  breakdown: ScoreBreakdown["clinical"];
} {
  const hasEscInputs =
    Boolean(options?.caseId) ||
    (Array.isArray(options?.goldStandardPath) && options!.goldStandardPath!.length > 0) ||
    (Array.isArray(options?.mandatoryExams) && options!.mandatoryExams!.length > 0) ||
    (Array.isArray(options?.executedActionIds) && options!.executedActionIds!.length > 0) ||
    (Array.isArray(options?.requestedExamIds) && options!.requestedExamIds!.length > 0) ||
    (Array.isArray(options?.orderedExams) && options!.orderedExams!.length > 0);

  if (hasEscInputs) {
    const result = computeEscAhaClinicalAccuracy({
      caseId: options?.caseId,
      caseTitle: options?.caseTitle,
      executedActionIds: options?.executedActionIds,
      requestedExamIds: options?.requestedExamIds,
      exams: options?.orderedExams,
      mandatoryExams: options?.mandatoryExams,
      inappropriateExams: options?.inappropriateExams,
      goldStandardPath: options?.goldStandardPath,
    });

    const penalized = applyConfusionalStateOmission({
      score: result.score,
      neurologicalRedFlagDetected: options?.neurologicalRedFlagDetected,
      actionIds: [
        ...(options?.executedActionIds ?? []),
        ...(options?.requestedExamIds ?? []),
        ...(options?.orderedExams ?? []).flatMap((exam) => [exam.id, exam.name]),
      ],
      breakdown: {
        base: 0,
        missedHigh: result.legacy.missedHigh,
        missedMedium: result.legacy.missedMedium,
        penaltyHigh: result.legacy.missedHigh * CRITICAL_WEIGHT_HIGH,
        penaltyMedium: 0,
        final: result.score,
        motivations: result.motivations as ScoreMotivation[],
        earnedWeight: result.legacy.earnedWeight,
        totalWeight: result.legacy.totalWeight,
        anamnesisCoveragePercent: options?.anamnesisCoveragePercent,
        expertAnalysis: result.expertAnalysis,
        framework: "esc-aha-recommendation-matrix",
        qualitativeLabel: result.qualitativeLabel,
        iatrogenicCritical: result.iatrogenicCritical,
        iatrogenicEvents: result.iatrogenicEvents,
        executedActionIds: result.executedActionIds,
        classI: result.classI,
        classIII: result.classIII,
        dimensions: {
          classIAdherence: {
            score: result.dimensions.classIAdherence.score,
            weight: result.dimensions.classIAdherence.weight,
            label: result.dimensions.classIAdherence.label,
            met: result.dimensions.classIAdherence.met,
            expected: result.dimensions.classIAdherence.expected,
          },
          classIIIAvoidance: {
            score: result.dimensions.classIIIAvoidance.score,
            weight: result.dimensions.classIIIAvoidance.weight,
            label: result.dimensions.classIIIAvoidance.label,
            met: result.dimensions.classIIIAvoidance.met,
            expected: result.dimensions.classIIIAvoidance.expected,
          },
          diagnosticSequencing: {
            score: result.dimensions.diagnosticSequencing.score,
            weight: result.dimensions.diagnosticSequencing.weight,
            label: result.dimensions.diagnosticSequencing.label,
            met: result.dimensions.diagnosticSequencing.met,
            expected: result.dimensions.diagnosticSequencing.expected,
          },
        },
      },
    });

    return applyFailedDiagnosisPenalty(
      applyClinicalTimePenalty(
        withTherapeuticBlend(
          { score: penalized.score, breakdown: penalized.breakdown },
          options,
        ),
        options,
      ),
      options,
    );
  }

  // Legacy fallback — LLM checklist (no fictitious +100 base).
  const actions = Array.isArray(criticalActions) ? criticalActions : [];
  const motivations: ScoreMotivation[] = [];

  let totalWeight = 0;
  let earnedWeight = 0;
  let missedHigh = 0;
  let missedMedium = 0;

  for (const a of actions) {
    const w = a.criticalLevel === "HIGH" ? CRITICAL_WEIGHT_HIGH : CRITICAL_WEIGHT_MEDIUM;
    totalWeight += w;
    if (a.performed) {
      earnedWeight += w;
      motivations.push(
        motivation("positive", `Eseguita azione critica ${a.criticalLevel} — «${a.description.slice(0, 72)}»`, {
          id: `clin_ok_${normalizeExamSlug(a.description).slice(0, 24)}`,
          scoreImpact: w,
          sourceRef: LEGAL_SOURCE_REFS.protocollo,
        }),
      );
    } else if (a.criticalLevel === "HIGH") {
      missedHigh += 1;
      motivations.push(
        motivation("negative", `Omessa azione critica HIGH — «${a.description.slice(0, 72)}»`, {
          id: `clin_miss_h_${normalizeExamSlug(a.description).slice(0, 24)}`,
          scoreImpact: -w,
          sourceRef: LEGAL_SOURCE_REFS.protocollo,
        }),
      );
    } else {
      missedMedium += 1;
      motivations.push(
        motivation("negative", `Omessa azione critica MEDIUM — «${a.description.slice(0, 72)}»`, {
          id: `clin_miss_m_${normalizeExamSlug(a.description).slice(0, 24)}`,
          scoreImpact: -w,
          sourceRef: LEGAL_SOURCE_REFS.protocollo,
        }),
      );
    }
  }

  const anamnesisPct = options?.anamnesisCoveragePercent;
  let final: number;

  if (totalWeight > 0) {
    const actionScore = (earnedWeight / totalWeight) * 100;
    if (typeof anamnesisPct === "number" && Number.isFinite(anamnesisPct)) {
      final = clampScore(actionScore * 0.7 + anamnesisPct * 0.3);
    } else {
      final = clampScore(actionScore);
    }
  } else if (typeof anamnesisPct === "number" && Number.isFinite(anamnesisPct)) {
    final = clampScore(anamnesisPct);
  } else {
    final = 0;
    motivations.push(
      motivation("negative", "Nessuna evidenza clinica valutabile rispetto al Gold Standard", {
        id: "clin_empty",
        scoreImpact: 0,
        sourceRef: LEGAL_SOURCE_REFS.protocollo,
      }),
    );
  }

  const legacyPenalized = applyConfusionalStateOmission({
    score: final,
    neurologicalRedFlagDetected: options?.neurologicalRedFlagDetected,
    actionIds: [
      ...(options?.executedActionIds ?? []),
      ...(options?.requestedExamIds ?? []),
      ...(options?.orderedExams ?? []).flatMap((exam) => [exam.id, exam.name]),
    ],
    breakdown: {
      base: 0,
      missedHigh,
      missedMedium,
      penaltyHigh: missedHigh * CRITICAL_WEIGHT_HIGH,
      penaltyMedium: missedMedium * CRITICAL_WEIGHT_MEDIUM,
      final,
      motivations,
      earnedWeight,
      totalWeight,
      anamnesisCoveragePercent: anamnesisPct,
    },
  });

  return applyFailedDiagnosisPenalty(
    applyClinicalTimePenalty(
      withTherapeuticBlend(
        { score: legacyPenalized.score, breakdown: legacyPenalized.breakdown },
        options,
      ),
      options,
    ),
    options,
  );
}

function applyClinicalTimePenalty(
  result: { score: number; breakdown: ScoreBreakdown["clinical"] },
  options?: {
    elapsedMinutes?: number | null;
    timeLimitMinutes?: number | null;
  },
): { score: number; breakdown: ScoreBreakdown["clinical"] } {
  const elapsed = options?.elapsedMinutes;
  const limit = options?.timeLimitMinutes;
  if (elapsed == null || !Number.isFinite(elapsed) || limit == null || !(limit > 0)) {
    return result;
  }

  const { overrunRatio, malusFraction, criticalTimeDelay } = clinicalTimeMalusFraction(elapsed, limit);
  const score = clampScore(result.score * (1 - malusFraction));
  const overrunPct = Math.round(overrunRatio * 100);
  const malusPct = Math.round(malusFraction * 1000) / 10;
  const motivations = [...(result.breakdown.motivations ?? [])];
  if (malusFraction > 0) {
    motivations.push(
      motivation("negative", criticalTimeDelay
        ? `Ritardo diagnostico critico: ${elapsed} min su limite ${limit} min (sforamento ${overrunPct}% > 50%) — decurtazione fissa 25%`
        : `Ritardo diagnostico: ${elapsed} min su limite ${limit} min (sforamento ${overrunPct}%) — decurtazione lineare ${malusPct}%`, {
        id: criticalTimeDelay ? "clin_time_critical" : "clin_time_linear",
        scoreImpact: score - result.score,
        sourceRef: "Rif. timeLimitMinutes del caso",
      }),
    );
  }

  return {
    score,
    breakdown: {
      ...result.breakdown,
      final: score,
      elapsedMinutes: elapsed,
      timeLimitMinutes: limit,
      timeOverrunRatio: overrunRatio,
      timeMalusFraction: malusFraction,
      criticalTimeDelay,
      motivations,
    },
  };
}

/**
 * −10 punti clinici per ogni diagnosi finale errata, dopo esami, terapia e tempo.
 * Il risultato resta in [0, 100].
 */
function applyFailedDiagnosisPenalty(
  result: { score: number; breakdown: ScoreBreakdown["clinical"] },
  options?: { failedDiagnosisAttempts?: number | null },
): { score: number; breakdown: ScoreBreakdown["clinical"] } {
  const raw = Number(options?.failedDiagnosisAttempts);
  const failedDiagnosisCount = Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : 0;
  const diagnosisPenalty = failedDiagnosisCount * DIAGNOSIS_ATTEMPT_PENALTY_POINTS;
  if (diagnosisPenalty <= 0) {
    return {
      ...result,
      breakdown: {
        ...result.breakdown,
        failedDiagnosisCount: 0,
        diagnosisPenalty: 0,
      },
    };
  }

  const score = clampScore(result.score - diagnosisPenalty);
  return {
    score,
    breakdown: {
      ...result.breakdown,
      final: score,
      failedDiagnosisCount,
      diagnosisPenalty,
      motivations: [
        ...(result.breakdown.motivations ?? []),
        motivation(
          "negative",
          `Diagnosi errata: ${failedDiagnosisCount} tentativ${failedDiagnosisCount === 1 ? "o fallito" : "i falliti"} — −${diagnosisPenalty} punti sul punteggio clinico (−${DIAGNOSIS_ATTEMPT_PENALTY_POINTS} a tentativo)`,
          {
            id: "clin_wrong_diagnosis",
            scoreImpact: score - result.score,
            sourceRef: "Rif. tentativi di diagnosi finale",
          },
        ),
      ],
    },
  };
}

function withTherapeuticBlend(
  result: { score: number; breakdown: ScoreBreakdown["clinical"] },
  options?: {
    baselineExamFindings?: unknown;
    prescribedMedications?: SessionPrescription[] | null;
  },
): { score: number; breakdown: ScoreBreakdown["clinical"] } {
  const allergyHits = detectAllergyFatalPrescriptions({
    baselineExamFindings: options?.baselineExamFindings,
    prescriptions: options?.prescribedMedications,
  });
  let working = result;
  if (allergyHits.length > 0) {
    working = {
      score: 0,
      breakdown: {
        ...result.breakdown,
        final: 0,
        iatrogenicCritical: true,
        qualitativeLabel: "Reazione allergica iatrogena grave",
        iatrogenicEvents: [
          ...(result.breakdown.iatrogenicEvents ?? []),
          ...allergyHits.map((hit) => ({
            actionId: hit.drugId,
            name: hit.description,
            rationale: hit.rationale,
          })),
        ],
        motivations: [
          ...(result.breakdown.motivations ?? []),
          ...allergyHits.map((hit) =>
            motivation("negative", hit.description, {
              id: `clin_allergy_${normalizeExamSlug(hit.drugId).slice(0, 24)}`,
              scoreImpact: -result.score,
              sourceRef: "Rif. Allergia nota del paziente / prontuario",
            }),
          ),
        ],
      },
    };
  }

  const applied = applyTherapyToClinicalScore({
    examScore: working.score,
    iatrogenicCritical: working.breakdown.iatrogenicCritical,
    baselineExamFindings: options?.baselineExamFindings,
    prescriptions: options?.prescribedMedications,
  });
  if (!applied.therapy || !applied.motivation) return working;
  return {
    score: applied.score,
    breakdown: {
      ...working.breakdown,
      final: applied.score,
      therapy: applied.therapy,
      motivations: [...(working.breakdown.motivations ?? []), applied.motivation],
      dimensions: working.breakdown.dimensions
        ? {
            ...working.breakdown.dimensions,
            therapeuticAppropriateness: {
              score: applied.therapy.score,
              weight: applied.therapy.weight,
              label: "Appropriatezza terapeutica",
              met: applied.therapy.indicatedMet,
              expected: applied.therapy.indicatedExpected,
            },
          }
        : working.breakdown.dimensions,
    },
  };
}

/**
 * Appropriatezza prescrittiva proporzionale al Gold Standard.
 * Esame in GS → punti; incongruente → −25%; nessun +100 base.
 */
export function computeAppropriatenessScore(
  inappropriateActions: InappropriateActionItem[] | null | undefined,
  options?: {
    orderedExams?: Array<{ id?: string; name?: string; cost?: number }> | null;
    goldStandardPath?: string[] | null;
  },
): {
  score: number;
  breakdown: ScoreBreakdown["exams"];
} {
  const actions = Array.isArray(inappropriateActions) ? inappropriateActions : [];
  const performed = actions.filter((a) => a.performed);
  const goldExams = extractMandatoryFirstLevelExams(options?.goldStandardPath);
  const ordered = Array.isArray(options?.orderedExams) ? options!.orderedExams! : [];
  const motivations: ScoreMotivation[] = [];

  let goldHits = 0;
  let score = 0;
  const pointsPerGold = goldExams.length > 0 ? 100 / goldExams.length : 0;

  if (goldExams.length > 0) {
    for (const g of goldExams) {
      const hit = ordered.some((exam) => examMatchesGold(exam, [g]));
      if (hit) {
        goldHits += 1;
        const impact = Math.round(pointsPerGold);
        score += pointsPerGold;
        motivations.push(
          motivation("positive", `Esame in Gold Standard richiesto: «${g}» — spesa virtuosa`, {
            id: `exam_gs_${g}`,
            scoreImpact: impact,
            sourceRef: LEGAL_SOURCE_REFS.protocollo,
          }),
        );
      } else {
        motivations.push(
          motivation("negative", `Omesso esame obbligatorio di I livello: «${g}»`, {
            id: `exam_miss_${g}`,
            scoreImpact: 0,
            sourceRef: LEGAL_SOURCE_REFS.protocollo,
          }),
        );
      }
    }
  }

  const overPrescribed = ordered.filter((exam) => {
    if (goldExams.length === 0) return false;
    return !examMatchesGold(exam, goldExams);
  });

  let penaltySum = 0;
  let overCount = 0;

  for (const a of performed) {
    const pen = Math.max(
      INCONGRUENT_EXAM_PENALTY_PERCENT,
      Math.min(30, Math.max(0, a.penaltyWeight || 0)),
    );
    // Avoid double-count if already counted as over-prescribed by name
    const alreadyOver = overPrescribed.some((exam) =>
      descriptionMatchesGold(a.description, [
        normalizeExamSlug(exam.id ?? ""),
        normalizeExamSlug(exam.name ?? ""),
      ].filter(Boolean)),
    );
    if (alreadyOver) continue;
    penaltySum += pen;
    motivations.push(
      motivation(
        "negative",
        `Esame incongruente/superfluo — «${a.description.slice(0, 72)}»`,
        {
          id: `exam_incong_${normalizeExamSlug(a.description).slice(0, 20)}`,
          scoreImpact: -pen,
          sourceRef: "Rif. Linee guida prescrittive / Protocollo clinico",
        },
      ),
    );
  }

  for (const exam of overPrescribed) {
    penaltySum += INCONGRUENT_EXAM_PENALTY_PERCENT;
    overCount += 1;
    motivations.push(
      motivation(
        "negative",
        `Esame incongruente/superfluo fuori Gold Standard — «${(exam.name || exam.id || "esame").slice(0, 72)}»`,
        {
          id: `exam_over_${normalizeExamSlug(exam.id || exam.name || "x").slice(0, 20)}`,
          scoreImpact: -INCONGRUENT_EXAM_PENALTY_PERCENT,
          sourceRef: LEGAL_SOURCE_REFS.nomenclatore,
        },
      ),
    );
  }

  // Fallback when no gold exams: derive from absence of incongruent only (proportional inverse)
  if (goldExams.length === 0) {
    const incongruentCount = performed.length;
    score = clampScore(100 - incongruentCount * INCONGRUENT_EXAM_PENALTY_PERCENT);
    if (incongruentCount === 0) {
      motivations.push(
        motivation(
          "neutral",
          "Nessun Gold Standard esami definito e nessun incongruente rilevato — copertura prescrittiva non verificabile al 100%",
          {
            id: "exam_no_gs",
            scoreImpact: score,
            sourceRef: LEGAL_SOURCE_REFS.protocollo,
          },
        ),
      );
      // Without GS, do not invent full marks — cap at 50 if no exams ordered either
      if (ordered.length === 0) {
        score = 0;
        motivations.push(
          motivation("negative", "Nessun esame prescritto e nessun protocollo esami — punteggio 0", {
            id: "exam_empty",
            scoreImpact: 0,
            sourceRef: LEGAL_SOURCE_REFS.protocollo,
          }),
        );
      } else {
        score = clampScore(Math.min(score, 70));
      }
    }
  } else {
    score = clampScore(score - penaltySum);
  }

  const final = clampScore(score);

  if (motivations.length === 0) {
    motivations.push(
      motivation("neutral", "Nessuna evidenza prescrittiva valutabile", {
        id: "exam_none",
        scoreImpact: 0,
        sourceRef: LEGAL_SOURCE_REFS.nomenclatore,
      }),
    );
  }

  return {
    score: final,
    breakdown: {
      base: 0,
      penaltySum,
      performedInappropriateCount: performed.length + overCount,
      final,
      motivations,
      overPrescriptionCount: overCount,
      goldHits,
      goldExpected: goldExams.length,
    },
  };
}

/**
 * Economia SSN / HTA — spesa effettiva vs ideale GS, efficienza clamp [0,100].
 * Zero divisioni per zero: effettiva=ideale=0 → scostamento 0%, efficienza 100%.
 */
export function computeEconomicSustainabilityScore(
  totalCostEuro: number,
  budgetEuro: number,
  options?: {
    examsAppropriatenessScore?: number;
    orderedExams?: Array<{ id?: string; name?: string; cost?: number }> | null;
    goldStandardPath?: string[] | null;
    caseId?: string | null;
    caseTitle?: string | null;
    mandatoryExams?: CaseExamDefinition[] | null;
    inappropriateExams?: CaseExamDefinition[] | null;
    baselineExamFindings?: unknown;
    prescribedMedications?: SessionPrescription[] | null;
  },
): { score: number; breakdown: ScoreBreakdown["economy"] } {
  const result = computeEconomySsnScore({
    caseId: options?.caseId,
    caseTitle: options?.caseTitle,
    totalCostEuro,
    budgetEuro,
    orderedExams: options?.orderedExams,
    goldStandardPath: options?.goldStandardPath,
    mandatoryExams: options?.mandatoryExams,
    inappropriateExams: options?.inappropriateExams,
    examsAppropriatenessScore: options?.examsAppropriatenessScore,
    baselineExamFindings: options?.baselineExamFindings,
    prescribedMedications: options?.prescribedMedications,
  });

  return {
    score: result.score,
    breakdown: {
      budgetEuro: result.budgetEuro,
      totalCostEuro: result.actualSpendEuro,
      examSpendEuro: result.examSpendEuro,
      medicationSpendEuro: result.medicationSpendEuro,
      formula: `Efficienza ${result.efficiencyPercent}% su (esami €${result.examSpendEuro.toFixed(2)} + farmaci €${result.medicationSpendEuro.toFixed(2)}) vs ideale €${result.idealSpendEuro.toFixed(2)} − sprechi €${result.wasteEuro.toFixed(2)} − omissioni`,
      final: result.score,
      motivations: result.motivations as ScoreMotivation[],
      appropriatenessCouplingApplied: result.appropriatenessCouplingApplied,
      underPrescriptionApplied: result.underPrescriptionApplied,
      overPrescriptionWasteEuro: result.wasteEuro,
      virtuousSpendEuro: result.virtuousSpendEuro,
      idealSpendEuro: result.idealSpendEuro,
      deltaSpendEuro: result.deltaSpendEuro,
      scostamentoPercent: result.scostamentoPercent,
      efficiencyPercent: result.efficiencyPercent,
      omissionEuro: result.omissionEuro,
      expertAnalysis: result.expertAnalysis,
      framework: "economy-ssn-hta",
      qualitativeLabel: result.qualitativeLabel,
      prescriptions: {
        virtuous: result.prescriptions.virtuous.map((p) => ({
          examId: p.examId,
          name: p.name,
          costEuro: p.costEuro,
          sourceRef: p.sourceRef,
        })),
        inappropriate: result.prescriptions.inappropriate.map((p) => ({
          examId: p.examId,
          name: p.name,
          costEuro: p.costEuro,
          sourceRef: p.sourceRef,
        })),
        omissions: result.prescriptions.omissions.map((p) => ({
          examId: p.examId,
          name: p.name,
          costEuro: p.costEuro,
          sourceRef: p.sourceRef,
        })),
      },
    },
  };
}

/**
 * Tutela medico-legale: esito GIURIDICO BINARIO (non voto numerico in UI).
 * Motore RAG-agnostico — citazioni dinamiche dal corpus specialty.
 * CONFORME (Scudo Legale Attivo) | NON CONFORME (Profilo di Rischio Contenzioso)
 */
export function computeLegalComplianceScore(
  reviews: LegalInstrumentReview[],
  options?: {
    hasLegalContext?: boolean;
    ragSourcesCount?: number;
    sessionMilestones?: Array<{ milestoneKey: string }> | null;
    chatHistory?: Array<{ role: string; content: string }> | null;
    caseId?: string | null;
    caseTitle?: string | null;
    legalChunks?: GuidelineChunk[] | null;
    legalSources?: string[] | null;
  },
): {
  score: number;
  breakdown: ScoreBreakdown["legal"];
} {
  const result = computeLegalRagConformity({
    caseId: options?.caseId,
    caseTitle: options?.caseTitle,
    chatHistory: options?.chatHistory,
    sessionMilestones: options?.sessionMilestones,
    legalInstrumentReviews: reviews,
    legalChunks: options?.legalChunks,
    legalSources: options?.legalSources,
    hasLegalContext: options?.hasLegalContext,
    ragSourcesCount: options?.ragSourcesCount,
  });

  return {
    score: result.score,
    breakdown: {
      applicableInstruments: result.applicableInstruments,
      violated: result.violated,
      partial: result.partial,
      weightPerInstrument: 0,
      final: result.score,
      motivations: result.motivations as ScoreMotivation[],
      ragSourcesCount: result.ragSourcesCount,
      hasLegalContext: result.hasLegalContext,
      usedProntuarioFallback: result.usedCorpusFallback,
      unevaluable: result.unevaluable,
      conformityStatus: result.conformityStatus,
      protectionLabel: result.conformityStatus,
      sourceRef: result.primarySourceRef,
      formalLabel: result.formalLabel,
      expertAnalysis: result.expertAnalysis,
      framework: "legal-rag-ctu",
      rilievi: result.rilievi,
      criteriaResults: result.criteriaResults,
    },
  };
}

/* ── Empathy — D-RIME Transazionale (SPIKES / RIAS / CARE) ─────────── */

export function qualitativeEmpathyLabel(breakdown: {
  finalScore: number;
  validationBonus: number;
  transparencyBonus: number;
  allianceBonus: number;
  dismissalPenalty: number;
  qualitativeLabel?: string;
}): string {
  if (breakdown.qualitativeLabel) return breakdown.qualitativeLabel;
  const { finalScore, dismissalPenalty } = breakdown;
  if (dismissalPenalty >= 25 && finalScore < 55) {
    return "Comunicazione a rischio — tono brusco o disattenzione all'ansia";
  }
  if (finalScore >= 85) {
    return "Eccellente alleanza terapeutica (D-RIME: SPIKES / RIAS / CARE)";
  }
  if (finalScore >= 70) return "Buona comunicazione patient-centered";
  if (finalScore >= 55) {
    return "Comunicazione professionale parziale — gap di validazione o esplorazione";
  }
  if (finalScore >= 40) return "Empatia insufficiente — deficit anamnestici/relazionali";
  return "Comunicazione a rischio — tono inadeguato o errore di priorità clinico-comportamentale";
}

export function computeBehavioralEmpathyScore(params: {
  chatHistory?: Array<{ role: string; content: string }> | null;
  empathyChecklist?: EmpathyChecklistItem[] | null;
  caseId?: string | null;
  caseContext?: string | null;
  caseTitle?: string | null;
  anamnesisQuestions?: AnamnesisQuestion[] | null;
  sessionMilestones?: Array<{ milestoneKey: string }> | null;
  patientProfile?: import("@/lib/data/cases/types").PatientProfile | null;
  classifiedIntents?: import("@/lib/reports/d-rime-engine").ClassifiedDoctorTurn[] | null;
  goldStandardPath?: string[] | null;
  prescribedMedicationCount?: number;
  /** Stress del paziente a fine simulazione (0–100). */
  finalPatientStress?: number | null;
}): { score: number; breakdown: EmpathyBehavioralBreakdown } {
  const result = computeCalgaryCambridgeEmpathy({
    chatHistory: params.chatHistory,
    caseId: params.caseId,
    caseContext: params.caseContext,
    caseTitle: params.caseTitle,
    anamnesisQuestions: params.anamnesisQuestions,
    sessionMilestones: params.sessionMilestones,
    patientProfile: params.patientProfile,
    classifiedIntents: params.classifiedIntents,
    goldStandardPath: params.goldStandardPath,
    prescribedMedicationCount: params.prescribedMedicationCount,
  });
  const checklist = Array.isArray(params.empathyChecklist) ? params.empathyChecklist : [];
  const d = result.dRime;
  const stress = communicationStressPenalty(params.finalPatientStress);
  const score = clampScore(result.score - stress.stressPenalty);
  const motivations = [...(result.motivations as ScoreMotivation[])];
  if (stress.stressPenalty > 0 && stress.finalStressLevel != null) {
    motivations.push(
      motivation(
        "negative",
        stress.criticalPatientStress
          ? `Stress critico del paziente (${stress.finalStressLevel}/100) — −${stress.stressPenalty} punti sulla comunicazione`
          : `Stress del paziente ${stress.finalStressLevel}/100 — −${stress.stressPenalty} punti sulla comunicazione`,
        {
          id: stress.criticalPatientStress ? "emp_stress_critical" : "emp_stress_moderate",
          scoreImpact: score - result.score,
          sourceRef: "Rif. stress finale del paziente",
        },
      ),
    );
  }
  return {
    score,
    breakdown: {
      baseline: result.legacy.baseline,
      validationBonus: result.legacy.validationBonus,
      transparencyBonus: result.legacy.transparencyBonus,
      allianceBonus: result.legacy.allianceBonus,
      dismissalPenalty: result.legacy.dismissalPenalty,
      finalScore: score,
      final: score,
      qualitativeLabel: result.qualitativeLabel,
      motivations,
      totalParameters: checklist.length,
      metParameters: checklist.filter((i) => i.met).length,
      expertAnalysis: result.expertAnalysis,
      framework: "d-rime",
      urgencyMode: result.urgencyMode,
      dimensions: {
        activeListening: {
          score: result.dimensions.activeListening.score,
          weight: result.dimensions.activeListening.weight,
          label: result.dimensions.activeListening.label,
        },
        emotionalValidation: {
          score: result.dimensions.emotionalValidation.score,
          weight: result.dimensions.emotionalValidation.weight,
          label: result.dimensions.emotionalValidation.label,
        },
        clinicalContext: {
          score: result.dimensions.clinicalContext.score,
          weight: result.dimensions.clinicalContext.weight,
          label: result.dimensions.clinicalContext.label,
        },
      },
      dRime: {
        spikesEmpathyScore: d.spikesEmpathyScore,
        riasAlignmentScore: d.riasAlignmentScore,
        careTrustScore: d.careTrustScore,
        allianceScore: d.allianceScore,
        biasManagementScore: d.biasManagementScore,
        defensiveMedicineScore: d.defensiveMedicineScore,
        initialState: d.initialState,
        finalState: d.finalState,
        trajectory: d.trajectory,
        relationalInsights: d.relationalInsights,
      },
      finalStressLevel: stress.finalStressLevel,
      stressPenalty: stress.stressPenalty,
      criticalPatientStress: stress.criticalPatientStress,
    },
  };
}

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
    legalInstrumentReviews?: LegalInstrumentReview[];
  totalCostEuro: number;
  budgetEuro: number;
  chatHistory?: Array<{ role: string; content: string }> | null;
  hasLegalContext?: boolean;
  ragSourcesCount?: number;
  sessionMilestones?: Array<{ milestoneKey: string }> | null;
  goldStandardPath?: string[] | null;
  orderedExams?: Array<{ id?: string; name?: string; cost?: number }> | null;
  caseId?: string | null;
  caseContext?: string | null;
  caseTitle?: string | null;
  anamnesisQuestions?: AnamnesisQuestion[] | null;
  patientProfile?: import("@/lib/data/cases/types").PatientProfile | null;
  executedActionIds?: string[] | null;
  requestedExamIds?: string[] | null;
  mandatoryExams?: CaseExamDefinition[] | null;
  inappropriateExams?: CaseExamDefinition[] | null;
  legalChunks?: GuidelineChunk[] | null;
  legalSources?: string[] | null;
  classifiedIntents?: import("@/lib/reports/d-rime-engine").ClassifiedDoctorTurn[] | null;
  neurologicalRedFlagDetected?: boolean;
  baselineExamFindings?: unknown;
  prescribedMedications?: SessionPrescription[] | null;
  elapsedMinutes?: number | null;
  timeLimitMinutes?: number | null;
  failedDiagnosisAttempts?: number | null;
  finalPatientStress?: number | null;
}): { scores: DimensionScores; breakdown: ScoreBreakdown } {
  const anamnesis = computeAnamnesisProtocolCoverage({
    chatHistory: params.chatHistory,
    sessionMilestones: params.sessionMilestones,
    goldStandardPath: params.goldStandardPath,
  });

  const clinical = computeClinicalAccuracyScore(params.criticalActions, {
    anamnesisCoveragePercent: anamnesis.coveragePercent,
    caseId: params.caseId,
    caseTitle: params.caseTitle,
    executedActionIds: params.executedActionIds,
    requestedExamIds: params.requestedExamIds,
    orderedExams: params.orderedExams,
    mandatoryExams: params.mandatoryExams,
    inappropriateExams: params.inappropriateExams,
    goldStandardPath: params.goldStandardPath,
    neurologicalRedFlagDetected: params.neurologicalRedFlagDetected,
    baselineExamFindings: params.baselineExamFindings,
    prescribedMedications: params.prescribedMedications,
    elapsedMinutes: params.elapsedMinutes,
    timeLimitMinutes: params.timeLimitMinutes,
    failedDiagnosisAttempts: params.failedDiagnosisAttempts,
  });
  const exams = computeAppropriatenessScore(params.inappropriateActions, {
    orderedExams: params.orderedExams,
    goldStandardPath: params.goldStandardPath,
  });
  const economy = computeEconomicSustainabilityScore(params.totalCostEuro, params.budgetEuro, {
    examsAppropriatenessScore: exams.score,
    orderedExams: params.orderedExams,
    goldStandardPath: params.goldStandardPath,
    caseId: params.caseId,
    caseTitle: params.caseTitle,
    mandatoryExams: params.mandatoryExams,
    inappropriateExams: params.inappropriateExams,
    baselineExamFindings: params.baselineExamFindings,
    prescribedMedications: params.prescribedMedications,
  });
  const legal = computeLegalComplianceScore(params.legalInstrumentReviews ?? [], {
    hasLegalContext: params.hasLegalContext,
    ragSourcesCount: params.ragSourcesCount,
    sessionMilestones: params.sessionMilestones,
    chatHistory: params.chatHistory,
    caseId: params.caseId,
    caseTitle: params.caseTitle,
    legalChunks: params.legalChunks,
    legalSources: params.legalSources,
  });
  const empathy = computeBehavioralEmpathyScore({
    chatHistory: params.chatHistory,
    empathyChecklist: params.empathyChecklist,
    caseId: params.caseId,
    caseContext: params.caseContext,
    caseTitle: params.caseTitle,
    anamnesisQuestions: params.anamnesisQuestions,
    sessionMilestones: params.sessionMilestones,
    patientProfile: params.patientProfile,
    classifiedIntents: params.classifiedIntents,
    goldStandardPath: params.goldStandardPath,
    finalPatientStress: params.finalPatientStress,
  });

  // Attach anamnesis detail to clinical motivations
  clinical.breakdown.anamnesisCoveragePercent = anamnesis.coveragePercent;
  clinical.breakdown.motivations.unshift(
    motivation(
      anamnesis.coveragePercent / 100 >= ANAMNESIS_COVERAGE_THRESHOLD ? "positive" : "negative",
      `Copertura anamnesi: ${anamnesis.covered}/${anamnesis.expected} punti chiave = ${anamnesis.coveragePercent}%`,
      {
        id: "clin_anamnesis_coverage",
        scoreImpact: anamnesis.coveragePercent,
        sourceRef: LEGAL_SOURCE_REFS.protocollo,
      },
    ),
  );

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
      communication: {
        finalStressLevel: empathy.breakdown.finalStressLevel ?? null,
        stressPenalty: empathy.breakdown.stressPenalty ?? 0,
        criticalPatientStress: empathy.breakdown.criticalPatientStress === true,
        final: empathy.score,
      },
    },
  };
}

/**
 * Gate pedagogici: cap anamnesi &lt;20% → max 15; riafferma tutela binaria; economia forchetta.
 */
export function applyPedagogicalSeverityGates(params: {
  scores: DimensionScores;
  breakdown: ScoreBreakdown;
  chatHistory?: Array<{ role: string; content: string }> | null;
  sessionMilestones?: Array<{ milestoneKey: string }> | null;
  inappropriateActions?: InappropriateActionItem[] | null;
  goldStandardPath?: string[] | null;
  orderedExams?: Array<{ id?: string; name?: string; cost?: number }> | null;
  caseId?: string | null;
  caseTitle?: string | null;
  mandatoryExams?: CaseExamDefinition[] | null;
  inappropriateExams?: CaseExamDefinition[] | null;
  baselineExamFindings?: unknown;
  prescribedMedications?: SessionPrescription[] | null;
}): { scores: DimensionScores; breakdown: ScoreBreakdown } {
  const scores = { ...params.scores };
  const breakdown: ScoreBreakdown = {
    clinical: {
      ...params.breakdown.clinical,
      motivations: [...(params.breakdown.clinical.motivations ?? [])],
    },
    exams: {
      ...params.breakdown.exams,
      motivations: [...(params.breakdown.exams.motivations ?? [])],
    },
    economy: {
      ...params.breakdown.economy,
      motivations: [...(params.breakdown.economy.motivations ?? [])],
    },
    legal: {
      ...params.breakdown.legal,
      motivations: [...(params.breakdown.legal.motivations ?? [])],
      conformityStatus:
        params.breakdown.legal.conformityStatus ??
        resolveLegalConformity(params.breakdown.legal.protectionLabel),
    },
    empathy: {
      ...params.breakdown.empathy,
      motivations: [...(params.breakdown.empathy.motivations ?? [])],
    },
    communication: params.breakdown.communication,
  };

  const coverage = computeAnamnesisProtocolCoverage({
    chatHistory: params.chatHistory,
    sessionMilestones: params.sessionMilestones,
    goldStandardPath: params.goldStandardPath,
  });
  breakdown.clinical.anamnesisCoveragePercent = coverage.coveragePercent;

  if (breakdown.clinical.iatrogenicCritical) {
    // Class III iatrogenic critical locks clinical at 0 — never raise via other gates.
    scores.clinical = 0;
    breakdown.clinical.final = 0;
  } else if (coverage.coveragePercent / 100 < ANAMNESIS_COVERAGE_THRESHOLD) {
    const before = scores.clinical;
    scores.clinical = Math.min(scores.clinical, CLINICAL_ANAMNESIS_SEVERITY_CAP);
    breakdown.clinical.final = scores.clinical;
    breakdown.clinical.anamnesisCapped = true;
    breakdown.clinical.motivations.push(
      motivation(
        "negative",
        `Anamnesi insufficiente (${coverage.coveragePercent}% < 20% punti chiave) — Appropriatezza Clinica bloccata a max ${CLINICAL_ANAMNESIS_SEVERITY_CAP}/100`,
        {
          id: "clin_cap_anamnesis",
          scoreImpact: scores.clinical - before,
          sourceRef: LEGAL_SOURCE_REFS.protocollo,
        },
      ),
    );
  }

  // Preserve prior legal RAG verdict — do not wipe rilievi by re-scoring with empty reviews.
  const priorNonConforme =
    resolveLegalConformity(params.breakdown.legal.protectionLabel) === "NON_CONFORME" ||
    params.breakdown.legal.conformityStatus === "NON_CONFORME" ||
    (params.breakdown.legal.violated ?? 0) > 0 ||
    (params.breakdown.legal.partial ?? 0) > 0;

  if (priorNonConforme) {
    scores.legal = LEGAL_NON_CONFORME_SCORE;
    breakdown.legal = {
      ...params.breakdown.legal,
      conformityStatus: "NON_CONFORME",
      protectionLabel: "NON_CONFORME",
      formalLabel: legalConformityFormalLabel("NON_CONFORME"),
      final: LEGAL_NON_CONFORME_SCORE,
      motivations: dedupeMotivationsByText(params.breakdown.legal.motivations ?? []),
      rilievi: params.breakdown.legal.rilievi,
      expertAnalysis: params.breakdown.legal.expertAnalysis,
      framework: params.breakdown.legal.framework ?? "legal-rag-ctu",
    };
  } else {
    scores.legal = LEGAL_CONFORME_SCORE;
    breakdown.legal = {
      ...params.breakdown.legal,
      conformityStatus: "CONFORME",
      protectionLabel: "CONFORME",
      formalLabel: legalConformityFormalLabel("CONFORME"),
      final: LEGAL_CONFORME_SCORE,
      motivations: dedupeMotivationsByText(params.breakdown.legal.motivations ?? []),
      rilievi: params.breakdown.legal.rilievi,
      expertAnalysis: params.breakdown.legal.expertAnalysis,
      framework: params.breakdown.legal.framework ?? "legal-rag-ctu",
    };
  }

  const examOnlyEuro =
    breakdown.economy.examSpendEuro ??
    Math.max(
      0,
      (breakdown.economy.totalCostEuro ?? 0) - (breakdown.economy.medicationSpendEuro ?? 0),
    );
  const economyRescored = computeEconomicSustainabilityScore(
    examOnlyEuro,
    breakdown.economy.budgetEuro,
    {
      examsAppropriatenessScore: scores.exams,
      orderedExams: params.orderedExams,
      goldStandardPath: params.goldStandardPath,
      caseId: params.caseId,
      caseTitle: params.caseTitle,
      mandatoryExams: params.mandatoryExams,
      inappropriateExams: params.inappropriateExams,
      baselineExamFindings: params.baselineExamFindings,
      prescribedMedications: params.prescribedMedications,
    },
  );
  scores.economy = economyRescored.score;
  breakdown.economy = economyRescored.breakdown;

  return { scores, breakdown };
}

export const MACRO_AREA_WEIGHTS = {
  clinicalDiagnostic: 0.3,
  legalCompliance: 0.3,
  examAppropriateness: 0.15,
  empathy: 0.15,
  economicSustainability: 0.1,
} as const;

export const MACRO_AREA_MAX_TRENTESIMI = {
  clinicalDiagnostic: 9,
  legalCompliance: 9,
  examAppropriateness: 4.5,
  empathy: 4.5,
  economicSustainability: 3,
} as const;

export function dimensionContributionTrentesimi(
  scorePercent: number,
  weight: number,
): number {
  const pct = Number.isFinite(scorePercent) ? Math.max(0, Math.min(100, scorePercent)) : 0;
  const w = Number.isFinite(weight) ? Math.max(0, Math.min(1, weight)) : 0;
  return Math.round((pct / 100) * w * 30 * 10) / 10;
}

export function computeTotalScoreTrentesimi(scores: DimensionScores): number {
  const w = MACRO_AREA_WEIGHTS;
  const total =
    dimensionContributionTrentesimi(scores?.clinical ?? 0, w.clinicalDiagnostic) +
    dimensionContributionTrentesimi(scores?.legal ?? 0, w.legalCompliance) +
    dimensionContributionTrentesimi(scores?.exams ?? 0, w.examAppropriateness) +
    dimensionContributionTrentesimi(scores?.empathy ?? 0, w.empathy) +
    dimensionContributionTrentesimi(scores?.economy ?? 0, w.economicSustainability);
  if (!Number.isFinite(total)) return 0;
  return Math.min(30, Math.max(0, Math.round(total * 10) / 10));
}
