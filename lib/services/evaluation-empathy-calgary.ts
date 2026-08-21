/**
 * Pilastro Comunicazione e Relazione Clinica — adapter D-RIME.
 * Il voto numerico è prodotto da `evaluateInteractionTrajectory` (stato Trust/Anxiety/Defensiveness).
 * Questo modulo mantiene la shape persistita (`CalgaryEmpathyResult`) per compatibilità del rawTrace.
 */

import type { AnamnesisQuestion, PatientProfile } from "@/lib/data/cases/types";
import { getCaseById, normalizeCaseLookupKey } from "@/lib/data/cases/registry";
import {
  evaluateInteractionTrajectory,
  D_RIME_REFS,
  type DRimeResult,
} from "@/lib/reports/d-rime-engine";

export type EmpathyScoreMotivation = {
  id: string;
  type: "positive" | "negative" | "neutral";
  text: string;
  sourceRef?: string;
  scoreImpact: number;
};

export const EMPATHY_RAG_REFS = {
  art20: D_RIME_REFS.art20,
  art24:
    "Rif. CODICE-DEONTOLOGIA-MEDICA-2014.pdf - Art. 24 (Informazione e consenso del paziente)",
  calgary: D_RIME_REFS.care,
  spikes: D_RIME_REFS.spikes,
  rias: D_RIME_REFS.rias,
  care: D_RIME_REFS.care,
} as const;

export type ClinicalUrgencyMode = "acute_emergency" | "stable_exploratory" | "standard";

export type EmpathyDimensionScore = {
  id: "active_listening" | "emotional_validation" | "clinical_context";
  label: string;
  score: number;
  weight: number;
  evidenceQuotes: string[];
  deficits: string[];
};

export type CalgaryEmpathyResult = {
  score: number;
  qualitativeLabel: string;
  expertAnalysis: string;
  urgencyMode: ClinicalUrgencyMode;
  dimensions: {
    activeListening: EmpathyDimensionScore;
    emotionalValidation: EmpathyDimensionScore;
    clinicalContext: EmpathyDimensionScore;
  };
  motivations: EmpathyScoreMotivation[];
  /** Legacy-compatible fields for persisted ScoreBreakdown.empathy */
  legacy: {
    baseline: number;
    validationBonus: number;
    transparencyBonus: number;
    allianceBonus: number;
    dismissalPenalty: number;
  };
  dRime: DRimeResult;
};

const ACUTE_CASE_IDS = new Set([
  "car-f01",
  "car-m02",
  "car-d01",
  "car-d02",
  "car-d03",
]);

const STABLE_EXPLORATORY_IDS = new Set([
  "car-f02",
  "car-m01",
  "car-m03",
  "car-m04",
  "car-d04",
]);

const ACUTE_CONTEXT_RE =
  /tamponament|edema polmonare|\bEPA\b|dissezione|shock|STEMI|ipossiem|SpO₂?\s*8|PA\s*8[0-9]|bradicardia.*3[0-9]|TV\s|arresto|PEA|Killip\s*III/i;

const STABLE_CONTEXT_RE =
  /pericardite|NSTEMI|atipic|diabetic|FA-ARV|fibrillazione atriale|stabile|palpitaz|equivalente anginoso/i;

export function resolveClinicalUrgencyMode(params: {
  caseId?: string | null;
  caseContext?: string | null;
  caseTitle?: string | null;
}): ClinicalUrgencyMode {
  const id = params.caseId ? normalizeCaseLookupKey(params.caseId) : "";
  if (id && ACUTE_CASE_IDS.has(id)) return "acute_emergency";
  if (id && STABLE_EXPLORATORY_IDS.has(id)) return "stable_exploratory";

  const blob = `${params.caseTitle ?? ""} ${params.caseContext ?? ""}`;
  if (ACUTE_CONTEXT_RE.test(blob)) return "acute_emergency";
  if (STABLE_CONTEXT_RE.test(blob)) return "stable_exploratory";
  return "standard";
}

function motivation(
  type: EmpathyScoreMotivation["type"],
  text: string,
  extra?: Partial<Pick<EmpathyScoreMotivation, "id" | "scoreImpact" | "sourceRef">>,
): EmpathyScoreMotivation {
  return {
    id: extra?.id ?? `emp_${type}_${Math.random().toString(36).slice(2, 8)}`,
    type,
    text,
    scoreImpact: extra?.scoreImpact ?? 0,
    sourceRef: extra?.sourceRef,
  };
}

function resolveAnamnesisQuestions(
  caseId?: string | null,
  explicit?: AnamnesisQuestion[] | null,
): AnamnesisQuestion[] {
  if (Array.isArray(explicit) && explicit.length > 0) return explicit;
  if (!caseId) return [];
  return getCaseById(caseId)?.anamnesisQuestions ?? [];
}

function resolvePatientProfile(
  caseId?: string | null,
  explicit?: PatientProfile | null,
): PatientProfile | null {
  if (explicit) return explicit;
  if (!caseId) return null;
  return getCaseById(caseId)?.patientProfile ?? null;
}

/**
 * Official communication score: D-RIME transactional trajectory.
 */
export function computeCalgaryCambridgeEmpathy(params: {
  chatHistory?: Array<{ role: string; content: string }> | null;
  caseId?: string | null;
  caseContext?: string | null;
  caseTitle?: string | null;
  anamnesisQuestions?: AnamnesisQuestion[] | null;
  sessionMilestones?: Array<{ milestoneKey: string }> | null;
  patientProfile?: PatientProfile | null;
}): CalgaryEmpathyResult {
  const questions = resolveAnamnesisQuestions(params.caseId, params.anamnesisQuestions);
  const profile = resolvePatientProfile(params.caseId, params.patientProfile);
  const dRime = evaluateInteractionTrajectory(params.chatHistory, profile, questions);
  const mode = resolveClinicalUrgencyMode({
    caseId: params.caseId,
    caseContext: params.caseContext,
    caseTitle: params.caseTitle,
  });

  const paternalism = dRime.acts.filter((a) => a.intent === "paternalism_disdain").length;
  const validations = dRime.acts.filter((a) => a.intent === "validation_deescalation").length;
  const listening = dRime.acts.filter((a) => a.intent === "open_listening").length;
  const concessions = dRime.acts.filter((a) => a.intent === "defensive_concession").length;

  const A: EmpathyDimensionScore = {
    id: "active_listening",
    label: "RIAS — ascolto aperto e allineamento socio-emotivo",
    score: dRime.riasAlignmentScore,
    weight: 0.3,
    evidenceQuotes: dRime.acts
      .filter((a) => a.intent === "open_listening")
      .slice(0, 3)
      .map((a) => a.utterance),
    deficits:
      listening === 0 && dRime.acts.length > 0
        ? ["Nessun atto di ascolto aperto (RIAS / SPIKES-Perception)."]
        : [],
  };
  const B: EmpathyDimensionScore = {
    id: "emotional_validation",
    label: "SPIKES — validazione emotiva e de-escalation",
    score: dRime.spikesEmpathyScore,
    weight: 0.4,
    evidenceQuotes: dRime.acts
      .filter((a) => a.intent === "validation_deescalation")
      .slice(0, 3)
      .map((a) => a.utterance),
    deficits:
      validations === 0 && dRime.acts.length > 0
        ? ["Assenza di validazione emotiva (SPIKES-Emotions)."]
        : paternalism > 0
          ? [`${paternalism} atti di paternalismo/sdegno rilevati.`]
          : [],
  };
  const C: EmpathyDimensionScore = {
    id: "clinical_context",
    label: "CARE / appropriatezza — fiducia senza medicina difensiva",
    score: Math.round((dRime.careTrustScore * 0.5 + dRime.defensiveMedicineScore * 0.5)),
    weight: 0.3,
    evidenceQuotes: dRime.relationalInsights.slice(0, 2),
    deficits:
      concessions > 0
        ? [`${concessions} concessioni difensive (richieste inappropriate accolte).`]
        : dRime.finalState.trust < 40
          ? ["Fiducia finale insufficiente (CARE Trust)."]
          : [],
  };

  const motivations: EmpathyScoreMotivation[] = [
    motivation(
      dRime.score >= 70 ? "positive" : "negative",
      `D-RIME: Alleanza ${dRime.allianceScore} · Bias ${dRime.biasManagementScore} · Medicina difensiva ${dRime.defensiveMedicineScore} → ${dRime.score}/100`,
      {
        id: "emp_drime_summary",
        scoreImpact: dRime.score,
        sourceRef: EMPATHY_RAG_REFS.care,
      },
    ),
    motivation("neutral", `SPIKES ${dRime.spikesEmpathyScore}/100`, {
      id: "emp_spikes",
      scoreImpact: dRime.spikesEmpathyScore,
      sourceRef: EMPATHY_RAG_REFS.spikes,
    }),
    motivation("neutral", `RIAS ${dRime.riasAlignmentScore}/100`, {
      id: "emp_rias",
      scoreImpact: dRime.riasAlignmentScore,
      sourceRef: EMPATHY_RAG_REFS.rias,
    }),
    motivation("neutral", `CARE Trust ${dRime.careTrustScore}/100`, {
      id: "emp_care",
      scoreImpact: dRime.careTrustScore,
      sourceRef: EMPATHY_RAG_REFS.care,
    }),
  ];

  for (const insight of dRime.relationalInsights.slice(0, 3)) {
    motivations.push(
      motivation(dRime.score >= 70 ? "positive" : "neutral", insight, {
        id: "emp_insight",
        scoreImpact: 0,
        sourceRef: EMPATHY_RAG_REFS.art20,
      }),
    );
  }

  return {
    score: dRime.score,
    qualitativeLabel: dRime.qualitativeLabel,
    expertAnalysis: dRime.expertAnalysis,
    urgencyMode: mode,
    dimensions: {
      activeListening: A,
      emotionalValidation: B,
      clinicalContext: C,
    },
    motivations,
    legacy: {
      baseline: dRime.initialState.trust,
      validationBonus: Math.min(55, validations * 18),
      transparencyBonus: Math.min(25, dRime.acts.filter((a) => a.intent === "information_spikes").length * 12),
      allianceBonus: Math.min(20, Math.max(0, dRime.finalState.trust - dRime.initialState.trust)),
      dismissalPenalty: paternalism * 18 + concessions * 12,
    },
    dRime,
  };
}
