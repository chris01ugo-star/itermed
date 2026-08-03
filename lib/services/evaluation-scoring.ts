import type { CaseDifficulty } from "@prisma/client";
import type { ExamClinicalMeta } from "@/lib/exam-default-values";
import type { ExamPayload } from "@/lib/services/evaluation-service";

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
  /** Appropriatezza prescrittiva degli esami (0–100). Weight 20% → max 6/30. */
  exams: number;
  /** Sostenibilità economica / budget SSN (0–100) — analitica / radar. */
  economy: number;
  /** Comunicazione ed empatia (0–100). Weight 20% → max 6/30. */
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
    totalCostEuro: number;
    formula: string;
    final: number;
    motivations: ScoreMotivation[];
    appropriatenessCouplingApplied?: boolean;
    underPrescriptionApplied?: boolean;
    overPrescriptionWasteEuro?: number;
    virtuousSpendEuro?: number;
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
    /** Citazione normativa principale in evidenza. */
    sourceRef?: string;
    formalLabel?: string;
  };
  empathy: EmpathyBehavioralBreakdown;
};

export const EMPATHY_PROFESSIONAL_BASELINE = 60;
/** @deprecated */
export const EMPATHY_EMPTY_CHECKLIST_BASELINE = EMPATHY_PROFESSIONAL_BASELINE;

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
export const LEGAL_SOURCE_REFS = {
  gelliArt5: "Rif. Art. 5 L. 24/2017 (Gelli-Bianco)",
  consensoL219: "Rif. Art. 1 L. 219/2017 (Consenso Informato)",
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
    ? "CONFORME (TUTELATO)"
    : "NON CONFORME (RISCHIO CONTENZIOSO)";
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
 * Accuratezza clinica proporzionale: peso azioni critiche eseguite / peso totale.
 * Nessun +100 di partenza.
 */
export function computeClinicalAccuracyScore(
  criticalActions: CriticalActionItem[] | null | undefined,
  options?: {
    anamnesisCoveragePercent?: number;
  },
): {
  score: number;
  breakdown: ScoreBreakdown["clinical"];
} {
  const actions = Array.isArray(criticalActions) ? criticalActions : [];
  const motivations: ScoreMotivation[] = [];

  let totalWeight = 0;
  let earnedWeight = 0;
  let missedHigh = 0;
  let missedMedium = 0;
  let performedHigh = 0;

  for (const a of actions) {
    const w = a.criticalLevel === "HIGH" ? CRITICAL_WEIGHT_HIGH : CRITICAL_WEIGHT_MEDIUM;
    totalWeight += w;
    if (a.performed) {
      earnedWeight += w;
      if (a.criticalLevel === "HIGH") performedHigh += 1;
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
    // 70% azioni critiche + 30% copertura anamnesi (se disponibile)
    const actionScore = (earnedWeight / totalWeight) * 100;
    if (typeof anamnesisPct === "number" && Number.isFinite(anamnesisPct)) {
      final = clampScore(actionScore * 0.7 + anamnesisPct * 0.3);
      motivations.push(
        motivation(
          "neutral",
          `Copertura anamnesi protocollo: ${anamnesisPct}% (peso 30% del punteggio clinico)`,
          {
            id: "clin_anamnesis_mix",
            scoreImpact: Math.round(anamnesisPct * 0.3),
            sourceRef: LEGAL_SOURCE_REFS.protocollo,
          },
        ),
      );
      motivations.push(
        motivation(
          "neutral",
          `Copertura azioni critiche: ${Math.round(actionScore)}% (${earnedWeight}/${totalWeight} peso)`,
          {
            id: "clin_actions_mix",
            scoreImpact: Math.round(actionScore * 0.7),
            sourceRef: LEGAL_SOURCE_REFS.protocollo,
          },
        ),
      );
    } else {
      final = clampScore(actionScore);
      motivations.push(
        motivation(
          "neutral",
          `Punteggio analitico: ${earnedWeight}/${totalWeight} peso azioni critiche = ${final}/100`,
          {
            id: "clin_proportional",
            scoreImpact: final,
            sourceRef: LEGAL_SOURCE_REFS.protocollo,
          },
        ),
      );
    }
  } else if (typeof anamnesisPct === "number" && Number.isFinite(anamnesisPct)) {
    final = clampScore(anamnesisPct);
    motivations.push(
      motivation(
        "neutral",
        `Nessuna azione critica checklist — punteggio = copertura anamnesi ${anamnesisPct}%`,
        {
          id: "clin_anamnesis_only",
          scoreImpact: final,
          sourceRef: LEGAL_SOURCE_REFS.protocollo,
        },
      ),
    );
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

  void performedHigh;

  return {
    score: final,
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
 * Economia a forchetta: spesa virtuosa GS vs spreco vs sotto-prescrizione.
 * Parte da 0 e costruisce il punteggio in modo analitico.
 */
export function computeEconomicSustainabilityScore(
  totalCostEuro: number,
  budgetEuro: number,
  options?: {
    examsAppropriatenessScore?: number;
    orderedExams?: Array<{ id?: string; name?: string; cost?: number }> | null;
    goldStandardPath?: string[] | null;
  },
): { score: number; breakdown: ScoreBreakdown["economy"] } {
  const motivations: ScoreMotivation[] = [];
  const goldExams = extractMandatoryFirstLevelExams(options?.goldStandardPath);
  const ordered = Array.isArray(options?.orderedExams) ? options!.orderedExams! : [];

  const missingMandatory = goldExams.filter(
    (g) => !ordered.some((exam) => examMatchesGold(exam, [g])),
  );
  const virtuous = ordered.filter((exam) =>
    goldExams.length === 0 ? false : examMatchesGold(exam, goldExams),
  );
  const overPrescribed = ordered.filter((exam) => {
    if (goldExams.length === 0) return false;
    return !examMatchesGold(exam, goldExams);
  });
  const wasteEuro = overPrescribed.reduce((sum, e) => sum + (Number(e.cost) || 0), 0);
  const virtuousSpendEuro = virtuous.reduce((sum, e) => sum + (Number(e.cost) || 0), 0);

  let score = 0;
  let formula = "Analitico: virtù prescrittiva × rispetto budget − sprechi − sotto-prescrizione";

  // Virtuous spend within budget earns proportional credit
  if (goldExams.length > 0) {
    const coverage = virtuous.length / goldExams.length;
    score = coverage * 70; // up to 70 from covering mandatory exams
    motivations.push(
      motivation(
        "positive",
        `Spesa virtuosa su ${virtuous.length}/${goldExams.length} esami Gold Standard (€${virtuousSpendEuro.toFixed(0)})`,
        {
          id: "eco_virtuous",
          scoreImpact: Math.round(coverage * 70),
          sourceRef: LEGAL_SOURCE_REFS.nomenclatore,
        },
      ),
    );
  } else if (totalCostEuro > 0 && totalCostEuro <= budgetEuro) {
    score = 50;
    motivations.push(
      motivation("neutral", `Spesa €${totalCostEuro.toFixed(0)} entro budget senza GS esami verificabile`, {
        id: "eco_budget_only",
        scoreImpact: 50,
        sourceRef: LEGAL_SOURCE_REFS.nomenclatore,
      }),
    );
  } else if (totalCostEuro <= 0) {
    score = 0;
    motivations.push(
      motivation("neutral", "Nessuna spesa SSN — punteggio economico 0 (nessuna attività prescrittiva)", {
        id: "eco_zero_spend",
        scoreImpact: 0,
        sourceRef: LEGAL_SOURCE_REFS.nomenclatore,
      }),
    );
  }

  // Budget respect bonus (up to +30) when GS coverage path used
  if (goldExams.length > 0 && totalCostEuro > 0) {
    if (totalCostEuro <= budgetEuro) {
      score += 30;
      motivations.push(
        motivation("positive", `Budget rispettato (€${totalCostEuro.toFixed(0)} ≤ €${budgetEuro})`, {
          id: "eco_budget_ok",
          scoreImpact: 30,
          sourceRef: LEGAL_SOURCE_REFS.nomenclatore,
        }),
      );
    } else {
      const overrunPenalty = Math.min(30, Math.round(30 * (1 - budgetEuro / totalCostEuro)));
      score -= overrunPenalty;
      formula = `Sforamento budget: €${totalCostEuro.toFixed(0)} / €${budgetEuro}`;
      motivations.push(
        motivation(
          "negative",
          `Sforamento budget — spesi €${totalCostEuro.toFixed(0)} su €${budgetEuro}`,
          {
            id: "eco_overrun",
            scoreImpact: -overrunPenalty,
            sourceRef: LEGAL_SOURCE_REFS.nomenclatore,
          },
        ),
      );
    }
  }

  let appropriatenessCouplingApplied = false;
  let underPrescriptionApplied = false;

  // Spreco da esami incongruenti
  if (wasteEuro > 0 || overPrescribed.length > 0) {
    const before = score;
    const wastePenalty = Math.min(
      40,
      Math.round(wasteEuro / 5) + overPrescribed.length * INCONGRUENT_EXAM_PENALTY_PERCENT,
    );
    score -= wastePenalty;
    appropriatenessCouplingApplied = true;
    motivations.push(
      motivation(
        "negative",
        `Spreco risorse SSN: ${overPrescribed.length} esami incongruenti (€${wasteEuro.toFixed(0)})`,
        {
          id: "eco_waste",
          scoreImpact: -Math.round(before - (before - wastePenalty)),
          sourceRef: LEGAL_SOURCE_REFS.nomenclatore,
        },
      ),
    );
  }

  const examsScore = options?.examsAppropriatenessScore;
  if (
    typeof examsScore === "number" &&
    Number.isFinite(examsScore) &&
    examsScore < EXAMS_APPROPRIATENESS_ECONOMY_THRESHOLD &&
    !appropriatenessCouplingApplied
  ) {
    const gap = EXAMS_APPROPRIATENESS_ECONOMY_THRESHOLD - examsScore;
    score -= gap;
    appropriatenessCouplingApplied = true;
    motivations.push(
      motivation(
        "negative",
        `Appropriatezza esami ${Math.round(examsScore)}% < ${EXAMS_APPROPRIATENESS_ECONOMY_THRESHOLD}% → spesa non etica/inefficiente`,
        {
          id: "eco_incong_coupling",
          scoreImpact: -gap,
          sourceRef: LEGAL_SOURCE_REFS.nomenclatore,
        },
      ),
    );
  }

  // Sotto-prescrizione pericolosa — mai 100%
  if (missingMandatory.length > 0) {
    const penalty = Math.min(
      70,
      UNDERPRESCRIPTION_ECONOMY_PENALTY + missingMandatory.length * 10,
    );
    score = Math.min(score, 100 - penalty);
    underPrescriptionApplied = true;
    motivations.push(
      motivation(
        "negative",
        `Sotto-prescrizione pericolosa: omessi ${missingMandatory.length} esami I livello (${missingMandatory.slice(0, 3).join(", ")}${missingMandatory.length > 3 ? "…" : ""})`,
        {
          id: "eco_underRx",
          scoreImpact: -penalty,
          sourceRef: LEGAL_SOURCE_REFS.protocollo,
        },
      ),
    );
  }

  const final = clampScore(score);
  // Hard rule: under-prescription can never yield 100
  const cappedFinal =
    underPrescriptionApplied && final >= 100 ? 100 - UNDERPRESCRIPTION_ECONOMY_PENALTY : final;

  return {
    score: clampScore(cappedFinal),
    breakdown: {
      budgetEuro,
      totalCostEuro,
      formula,
      final: clampScore(cappedFinal),
      motivations,
      appropriatenessCouplingApplied,
      underPrescriptionApplied,
      overPrescriptionWasteEuro: wasteEuro,
      virtuousSpendEuro,
    },
  };
}

/**
 * Tutela medico-legale: esito GIURIDICO BINARIO (non voto numerico in UI).
 * CONFORME (TUTELATO) | NON CONFORME (RISCHIO CONTENZIOSO)
 * Citazione normativa obbligatoria su ogni giudizio.
 */
export function computeLegalComplianceScore(
  reviews: LegalInstrumentReview[],
  options?: {
    hasLegalContext?: boolean;
    ragSourcesCount?: number;
    sessionMilestones?: Array<{ milestoneKey: string }> | null;
    chatHistory?: Array<{ role: string; content: string }> | null;
  },
): {
  score: number;
  breakdown: ScoreBreakdown["legal"];
} {
  const safeReviews = Array.isArray(reviews) ? reviews : [];
  const ragSourcesCount =
    typeof options?.ragSourcesCount === "number"
      ? Math.max(0, options.ragSourcesCount)
      : options?.hasLegalContext
        ? 1
        : 0;
  const hasRagCorpus = (options?.hasLegalContext ?? false) && ragSourcesCount > 0;
  const usedProntuarioFallback = !hasRagCorpus;

  const applicable = safeReviews.filter((r) => r.compliance !== "non_applicabile");
  const violatedReviews = applicable.filter(
    (r) => r.compliance === "violato" || r.compliance === "parziale",
  );
  const respectedReviews = applicable.filter((r) => r.compliance === "rispettato");

  const milestoneKeys = new Set(
    (options?.sessionMilestones ?? []).map((m) => m.milestoneKey).filter(Boolean),
  );
  const chat = Array.isArray(options?.chatHistory) ? options!.chatHistory! : [];
  const doctorTurns = chat.filter(
    (m) => m.role === "user" && typeof m.content === "string" && m.content.trim().length > 0,
  );
  const doctorText = doctorTurns.map((t) => t.content).join("\n");
  const hasMilestone = (key: string) =>
    milestoneKeys.has(key) ||
    [...milestoneKeys].some((k) => k.includes(key) || key.includes(k));

  const safetyChecks: Array<{ ok: boolean; label: string; sourceRef: string }> = [
    {
      ok:
        hasMilestone("consenso_informato") ||
        /consenso informato|ha compreso i rischi|accetta (l['']esame|la procedura)/i.test(doctorText),
      label: "Consenso informato / informativa sui rischi",
      sourceRef: LEGAL_SOURCE_REFS.consensoL219,
    },
    {
      ok: hasMilestone("indagate_allergie") || /allergi/i.test(doctorText),
      label: "Rilevazione allergie (sicurezza prescrittiva)",
      sourceRef: LEGAL_SOURCE_REFS.deontologia35,
    },
    {
      ok:
        hasMilestone("anamnesi_farmaci") ||
        /farmaci|terapia in atto|assume/i.test(doctorText),
      label: "Anamnesi farmacologica",
      sourceRef: LEGAL_SOURCE_REFS.gelliArt5,
    },
  ];

  const milestonesTracked = milestoneKeys.size > 0 || doctorTurns.length > 0;
  const safetyViolations = milestonesTracked ? safetyChecks.filter((c) => !c.ok) : [];
  const hasViolation = violatedReviews.length > 0 || safetyViolations.length > 0;

  const motivations: ScoreMotivation[] = [];

  if (usedProntuarioFallback) {
    motivations.push(
      motivation(
        "neutral",
        "Corpus RAG non disponibile per la disciplina — applicazione Prontuario Medico-Legale Base SSN",
        {
          id: "legal_fallback",
          scoreImpact: 0,
          sourceRef: LEGAL_SOURCE_REFS.prontuario,
        },
      ),
    );
  } else {
    motivations.push(
      motivation("neutral", `Corpus RAG attivo (${ragSourcesCount} fonti medico-legali)`, {
        id: "legal_rag_active",
        scoreImpact: 0,
        sourceRef: LEGAL_SOURCE_REFS.gelliArt5,
      }),
    );
  }

  for (const r of respectedReviews.slice(0, 8)) {
    const ref =
      r.documentTitle?.trim() ||
      (r.instrument.includes("24/2017") ? LEGAL_SOURCE_REFS.gelliArt5 : r.instrument);
    motivations.push(
      motivation("positive", `Obbligo rispettato — «${r.instrument}»: ${r.rationale.slice(0, 120)}`, {
        id: `legal_ok_${normalizeExamSlug(r.instrument).slice(0, 20)}`,
        scoreImpact: 0,
        sourceRef: ref.startsWith("Rif.") ? ref : `Rif. ${ref}`,
      }),
    );
  }

  for (const r of violatedReviews) {
    const ref =
      r.documentTitle?.trim() ||
      (r.instrument.toLowerCase().includes("consenso")
        ? LEGAL_SOURCE_REFS.consensoL219
        : LEGAL_SOURCE_REFS.gelliArt5);
    motivations.push(
      motivation(
        "negative",
        `Violazione — «${r.instrument}»: ${r.rationale.slice(0, 140)}`,
        {
          id: `legal_viol_${normalizeExamSlug(r.instrument).slice(0, 20)}`,
          scoreImpact: 0,
          sourceRef: ref.startsWith("Rif.") ? ref : `Rif. ${ref}`,
        },
      ),
    );
  }

  for (const v of safetyViolations) {
    motivations.push(
      motivation("negative", `Inadempimento di sicurezza: ${v.label}`, {
        id: `legal_safety_${normalizeExamSlug(v.label).slice(0, 20)}`,
        scoreImpact: 0,
        sourceRef: v.sourceRef,
      }),
    );
  }

  const conformityStatus: LegalConformityStatus = hasViolation ? "NON_CONFORME" : "CONFORME";
  const score =
    conformityStatus === "CONFORME" ? LEGAL_CONFORME_SCORE : LEGAL_NON_CONFORME_SCORE;
  const sourceRef =
    violatedReviews[0]?.documentTitle?.trim() ||
    (violatedReviews[0]?.instrument
      ? `Rif. ${violatedReviews[0].instrument}`
      : undefined) ||
    safetyViolations[0]?.sourceRef ||
    respectedReviews[0]?.documentTitle?.trim() ||
    (usedProntuarioFallback ? LEGAL_SOURCE_REFS.gelliArt5 : LEGAL_SOURCE_REFS.gelliArt5);

  const formalLabel = legalConformityFormalLabel(conformityStatus);
  motivations.push(
    motivation(
      conformityStatus === "CONFORME" ? "positive" : "negative",
      formalLabel,
      {
        id: "legal_verdict",
        scoreImpact: 0,
        sourceRef,
      },
    ),
  );

  return {
    score,
    breakdown: {
      applicableInstruments: Math.max(applicable.length, safetyChecks.length),
      violated:
        violatedReviews.filter((r) => r.compliance === "violato").length +
        safetyViolations.length,
      partial: violatedReviews.filter((r) => r.compliance === "parziale").length,
      weightPerInstrument: 0,
      final: score,
      motivations,
      ragSourcesCount,
      hasLegalContext: hasRagCorpus,
      usedProntuarioFallback,
      unevaluable: false,
      conformityStatus,
      protectionLabel: conformityStatus,
      sourceRef,
      formalLabel,
    },
  };
}

/* ── Empathy (behavioral; no fictitious +100) ─────────────────────── */

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
  if (finalScore >= 75 && allianceBonus >= 10) return "Buona alleanza terapeutica";
  if (finalScore >= 70 && transparencyBonus >= 10 && validationBonus < 10) {
    return "Comunicazione tecnica ma rispettosa";
  }
  if (finalScore >= 60) return "Comunicazione professionale corretta";
  if (finalScore >= 45) return "Empatia insufficiente — gap di validazione o trasparenza";
  return "Comunicazione a rischio — tono brusco o disattenzione all'ansia";
}

export function computeBehavioralEmpathyScore(params: {
  chatHistory?: Array<{ role: string; content: string }> | null;
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
    if (UNEXPLAINED_JARGON_RE.test(turn) && !TRANSPARENCY_RE.test(turn)) jargonHits += 1;
  }

  const validationBonus = scaledBonus(validationHits, 10, 20);
  const transparencyBonus = scaledBonus(transparencyHits, 10, 20);
  const allianceBonus = allianceHits > 0 ? 10 : 0;

  let dismissalPenalty = 0;
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

  // Earned score: professional floor only if doctor engaged; otherwise 0 start + earned bonuses
  const engaged = doctorTurns.length > 0;
  const floor = engaged ? EMPATHY_PROFESSIONAL_BASELINE : 0;
  const raw = floor + validationBonus + transparencyBonus + allianceBonus - dismissalPenalty;
  const floored =
    engaged && dismissalPenalty === 0 ? Math.max(EMPATHY_PROFESSIONAL_BASELINE, raw) : raw;
  const finalScore = clampScore(floored);

  const checklist = Array.isArray(params.empathyChecklist) ? params.empathyChecklist : [];
  const motivations: ScoreMotivation[] = [];
  if (engaged) {
    motivations.push(
      motivation("positive", "Competenza comunicativa professionale dimostrata in chat", {
        id: "emp_floor",
        scoreImpact: EMPATHY_PROFESSIONAL_BASELINE,
        sourceRef: "Rif. Modello comportamentale Aequan — empatia clinica",
      }),
    );
  } else {
    motivations.push(
      motivation("negative", "Nessun turno medico — empatia non dimostrata", {
        id: "emp_empty",
        scoreImpact: 0,
        sourceRef: "Rif. Modello comportamentale Aequan — empatia clinica",
      }),
    );
  }
  if (validationBonus > 0) {
    motivations.push(
      motivation("positive", "Validazione emotiva del disagio/ansia", {
        id: "emp_val",
        scoreImpact: validationBonus,
      }),
    );
  }
  if (transparencyBonus > 0) {
    motivations.push(
      motivation("positive", "Trasparenza su manovre/esami", {
        id: "emp_trans",
        scoreImpact: transparencyBonus,
      }),
    );
  }
  if (allianceBonus > 0) {
    motivations.push(
      motivation("positive", "Alleanza terapeutica", {
        id: "emp_ally",
        scoreImpact: allianceBonus,
      }),
    );
  }
  if (anxietyIgnored) {
    motivations.push(
      motivation("negative", "Disattenzione all'ansia del paziente", {
        id: "emp_anx",
        scoreImpact: -15,
      }),
    );
  }
  if (brusqueHits > 0) {
    motivations.push(
      motivation("negative", "Linguaggio brusco o imperativo", {
        id: "emp_brusque",
        scoreImpact: -25,
      }),
    );
  }
  if (jargonHits > 0) {
    motivations.push(
      motivation("negative", "Gergo tecnico non spiegato", {
        id: "emp_jargon",
        scoreImpact: -15,
      }),
    );
  }

  const partial = {
    finalScore,
    validationBonus,
    transparencyBonus,
    allianceBonus,
    dismissalPenalty,
  };

  return {
    score: finalScore,
    breakdown: {
      baseline: engaged ? EMPATHY_PROFESSIONAL_BASELINE : 0,
      validationBonus,
      transparencyBonus,
      allianceBonus,
      dismissalPenalty,
      finalScore,
      final: finalScore,
      qualitativeLabel: qualitativeEmpathyLabel(partial),
      motivations,
      totalParameters: checklist.length,
      metParameters: checklist.filter((i) => i.met).length,
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
  legalInstrumentReviews: LegalInstrumentReview[];
  totalCostEuro: number;
  budgetEuro: number;
  chatHistory?: Array<{ role: string; content: string }> | null;
  hasLegalContext?: boolean;
  ragSourcesCount?: number;
  sessionMilestones?: Array<{ milestoneKey: string }> | null;
  goldStandardPath?: string[] | null;
  orderedExams?: Array<{ id?: string; name?: string; cost?: number }> | null;
}): { scores: DimensionScores; breakdown: ScoreBreakdown } {
  const anamnesis = computeAnamnesisProtocolCoverage({
    chatHistory: params.chatHistory,
    sessionMilestones: params.sessionMilestones,
    goldStandardPath: params.goldStandardPath,
  });

  const clinical = computeClinicalAccuracyScore(params.criticalActions, {
    anamnesisCoveragePercent: anamnesis.coveragePercent,
  });
  const exams = computeAppropriatenessScore(params.inappropriateActions, {
    orderedExams: params.orderedExams,
    goldStandardPath: params.goldStandardPath,
  });
  const economy = computeEconomicSustainabilityScore(params.totalCostEuro, params.budgetEuro, {
    examsAppropriatenessScore: exams.score,
    orderedExams: params.orderedExams,
    goldStandardPath: params.goldStandardPath,
  });
  const legal = computeLegalComplianceScore(params.legalInstrumentReviews, {
    hasLegalContext: params.hasLegalContext,
    ragSourcesCount: params.ragSourcesCount,
    sessionMilestones: params.sessionMilestones,
    chatHistory: params.chatHistory,
  });
  const empathy = computeBehavioralEmpathyScore({
    chatHistory: params.chatHistory,
    empathyChecklist: params.empathyChecklist,
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
  };

  const coverage = computeAnamnesisProtocolCoverage({
    chatHistory: params.chatHistory,
    sessionMilestones: params.sessionMilestones,
    goldStandardPath: params.goldStandardPath,
  });
  breakdown.clinical.anamnesisCoveragePercent = coverage.coveragePercent;

  if (coverage.coveragePercent / 100 < ANAMNESIS_COVERAGE_THRESHOLD) {
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

  // Re-affirm binary legal from live evidence
  const legalRescored = computeLegalComplianceScore([], {
    hasLegalContext: params.breakdown.legal.hasLegalContext,
    ragSourcesCount: params.breakdown.legal.ragSourcesCount,
    sessionMilestones: params.sessionMilestones,
    chatHistory: params.chatHistory,
  });
  // Preserve violations already recorded in reviews via previous breakdown
  const priorNonConforme =
    resolveLegalConformity(params.breakdown.legal.protectionLabel) === "NON_CONFORME" ||
    params.breakdown.legal.conformityStatus === "NON_CONFORME" ||
    (params.breakdown.legal.violated ?? 0) > 0;

  if (priorNonConforme || legalRescored.breakdown.conformityStatus === "NON_CONFORME") {
    scores.legal = LEGAL_NON_CONFORME_SCORE;
    breakdown.legal = {
      ...legalRescored.breakdown,
      conformityStatus: "NON_CONFORME",
      protectionLabel: "NON_CONFORME",
      formalLabel: legalConformityFormalLabel("NON_CONFORME"),
      final: LEGAL_NON_CONFORME_SCORE,
      motivations: [
        ...params.breakdown.legal.motivations.filter((m) => m.type === "negative"),
        ...legalRescored.breakdown.motivations.filter(
          (m) => m.type === "negative" || m.id === "legal_verdict",
        ),
      ],
      sourceRef:
        legalRescored.breakdown.sourceRef ||
        params.breakdown.legal.sourceRef ||
        LEGAL_SOURCE_REFS.gelliArt5,
    };
  } else {
    scores.legal = LEGAL_CONFORME_SCORE;
    breakdown.legal = {
      ...legalRescored.breakdown,
      conformityStatus: "CONFORME",
      protectionLabel: "CONFORME",
      formalLabel: legalConformityFormalLabel("CONFORME"),
      final: LEGAL_CONFORME_SCORE,
      motivations: legalRescored.breakdown.motivations,
      sourceRef:
        legalRescored.breakdown.sourceRef ||
        params.breakdown.legal.sourceRef ||
        LEGAL_SOURCE_REFS.gelliArt5,
    };
  }

  const economyRescored = computeEconomicSustainabilityScore(
    breakdown.economy.totalCostEuro,
    breakdown.economy.budgetEuro,
    {
      examsAppropriatenessScore: scores.exams,
      orderedExams: params.orderedExams,
      goldStandardPath: params.goldStandardPath,
    },
  );
  scores.economy = economyRescored.score;
  breakdown.economy = economyRescored.breakdown;

  return { scores, breakdown };
}

export const MACRO_AREA_WEIGHTS = {
  clinicalDiagnostic: 0.3,
  legalCompliance: 0.3,
  examAppropriateness: 0.2,
  empathy: 0.2,
} as const;

export const MACRO_AREA_MAX_TRENTESIMI = {
  clinicalDiagnostic: 9,
  legalCompliance: 9,
  examAppropriateness: 6,
  empathy: 6,
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
    dimensionContributionTrentesimi(scores.clinical, w.clinicalDiagnostic) +
    dimensionContributionTrentesimi(scores.legal, w.legalCompliance) +
    dimensionContributionTrentesimi(scores.exams, w.examAppropriateness) +
    dimensionContributionTrentesimi(scores.empathy, w.empathy);
  if (!Number.isFinite(total)) return 0;
  return Math.min(30, Math.max(0, Math.round(total * 10) / 10));
}
