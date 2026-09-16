/**
 * D-RIME Finite State Machine — pure, table-driven Trust / Anxiety / Defensiveness.
 *
 * The LLM may only classify doctor utterances into intent categories.
 * Numeric ΔT / ΔA / ΔD are produced exclusively by this module.
 */

export const DOCTOR_INTENT_CATEGORIES = [
  "EMPATHIC_EXPLORATION",
  "PATERNALISTIC_COMMAND",
  "VALIDATION",
  "DEFENSIVE_REACTION",
  "CLINICAL_DISCLOSURE",
  "DISCORDANCE",
  "FORMULAIC_EMPATHY",
  "EMOTIONAL_BYPASS",
  "OPTION_ELICITATION",
  "NEUTRAL",
] as const;

export type DoctorIntentCategory = (typeof DOCTOR_INTENT_CATEGORIES)[number];

export type PatientAffectState = {
  trust: number;
  anxiety: number;
  defensiveness: number;
};

export type FsmVariant = "standard" | "cyberchondria";

export type FsmTransitionResult = {
  intent: DoctorIntentCategory;
  previous: PatientAffectState;
  delta: PatientAffectState;
  next: PatientAffectState;
};

export type ClassifiedIntent = {
  category: DoctorIntentCategory;
  confidence: number;
  explanation: string;
};

export type ClassifiedDoctorTurn = {
  turnIndex: number;
  utteranceExcerpt?: string;
  intents: ClassifiedIntent[];
};

export const INTENT_LABELS: Record<DoctorIntentCategory, string> = {
  EMPATHIC_EXPLORATION: "Esplorazione empatica",
  PATERNALISTIC_COMMAND: "Comando paternalistico",
  VALIDATION: "Validazione emotiva",
  DEFENSIVE_REACTION: "Reazione difensiva",
  CLINICAL_DISCLOSURE: "Disclosure clinica",
  DISCORDANCE: "Discordanza / distress ignorato",
  FORMULAIC_EMPATHY: "Empatia formulaica / frase fatta",
  EMOTIONAL_BYPASS: "Bypass emotivo (salto al task clinico)",
  OPTION_ELICITATION: "Elicitazione di opzioni (decisione condivisa)",
  NEUTRAL: "Atto clinico neutro",
};

/**
 * Frozen integer deltas. Same (state, intent, variant) always yields the same next state.
 */
export const STANDARD_INTENT_DELTAS: Readonly<Record<DoctorIntentCategory, PatientAffectState>> =
  Object.freeze({
    EMPATHIC_EXPLORATION: Object.freeze({ trust: 9, anxiety: -5, defensiveness: -6 }),
    PATERNALISTIC_COMMAND: Object.freeze({ trust: -16, anxiety: 9, defensiveness: 18 }),
    VALIDATION: Object.freeze({ trust: 12, anxiety: -14, defensiveness: -11 }),
    DEFENSIVE_REACTION: Object.freeze({ trust: 5, anxiety: -6, defensiveness: -3 }),
    CLINICAL_DISCLOSURE: Object.freeze({ trust: 6, anxiety: -8, defensiveness: -3 }),
    DISCORDANCE: Object.freeze({ trust: -8, anxiety: 10, defensiveness: 12 }),
    /** Frase fatta: fiducia cala, il paziente percepisce inautenticità. */
    FORMULAIC_EMPATHY: Object.freeze({ trust: -5, anxiety: 2, defensiveness: 8 }),
    /** Emozione forte ignorata → crollo di fiducia e picco d'ansia. */
    EMOTIONAL_BYPASS: Object.freeze({ trust: -24, anxiety: 22, defensiveness: 8 }),
    /** Shared decision making: peso di Trust superiore a VALIDATION (+12). */
    OPTION_ELICITATION: Object.freeze({ trust: 18, anxiety: -10, defensiveness: -12 }),
    NEUTRAL: Object.freeze({ trust: 0, anxiety: 0, defensiveness: 0 }),
  });

export const CYBERCHONDRIA_INTENT_DELTAS: Readonly<
  Record<DoctorIntentCategory, PatientAffectState>
> = Object.freeze({
  EMPATHIC_EXPLORATION: Object.freeze({ trust: 7, anxiety: -5, defensiveness: -7 }),
  PATERNALISTIC_COMMAND: Object.freeze({ trust: -26, anxiety: 16, defensiveness: 28 }),
  VALIDATION: Object.freeze({ trust: 10, anxiety: -10, defensiveness: -8 }),
  DEFENSIVE_REACTION: Object.freeze({ trust: 2, anxiety: -4, defensiveness: 8 }),
  CLINICAL_DISCLOSURE: Object.freeze({ trust: 8, anxiety: -12, defensiveness: -6 }),
  DISCORDANCE: Object.freeze({ trust: -12, anxiety: 14, defensiveness: 18 }),
  FORMULAIC_EMPATHY: Object.freeze({ trust: -8, anxiety: 4, defensiveness: 12 }),
  EMOTIONAL_BYPASS: Object.freeze({ trust: -30, anxiety: 26, defensiveness: 12 }),
  OPTION_ELICITATION: Object.freeze({ trust: 15, anxiety: -8, defensiveness: -10 }),
  NEUTRAL: Object.freeze({ trust: -2, anxiety: 3, defensiveness: 4 }),
});

/**
 * Minimum LLM confidence required to drive an FSM transition.
 * Below this, the pipeline must use lexical fallback or NEUTRAL (Δ = 0).
 * Low-confidence labels must never apply marked T/A/D deltas.
 */
export const LLM_INTENT_CONFIDENCE_THRESHOLD = 0.6;


export function isDoctorIntentCategory(value: unknown): value is DoctorIntentCategory {
  return (
    typeof value === "string" &&
    (DOCTOR_INTENT_CATEGORIES as readonly string[]).includes(value)
  );
}

/**
 * Closed unit interval [0, 100] applied independently to T, A and D.
 * Used at every FSM step — never deferred to sequence end — so negative /
 * >100 deltas cannot accumulate in the intermediate trajectory.
 */
export function clampUnitInterval(val: number): number {
  if (!Number.isFinite(val)) return 0;
  return Math.min(100, Math.max(0, val));
}

export function clampAffect(n: number): number {
  return Math.round(clampUnitInterval(n));
}

export function clampAffectState(state: PatientAffectState): PatientAffectState {
  return {
    trust: clampAffect(state.trust),
    anxiety: clampAffect(state.anxiety),
    defensiveness: clampAffect(state.defensiveness),
  };
}

export function deltaTableFor(variant: FsmVariant = "standard"): Readonly<
  Record<DoctorIntentCategory, PatientAffectState>
> {
  return variant === "cyberchondria" ? CYBERCHONDRIA_INTENT_DELTAS : STANDARD_INTENT_DELTAS;
}

/**
 * Pure FSM step: (T, A, D) × intent → (T', A', D') with predefined deltas.
 * Each axis is clamped with Math.min(100, Math.max(0, val)) on this step
 * before the next intent is applied.
 */
export function transitionAffectState(
  state: PatientAffectState,
  intent: DoctorIntentCategory,
  variant: FsmVariant = "standard",
): FsmTransitionResult {
  const previous = clampAffectState(state);
  const tableDelta = deltaTableFor(variant)[intent];
  const delta: PatientAffectState = {
    trust: tableDelta.trust,
    anxiety: tableDelta.anxiety,
    defensiveness: tableDelta.defensiveness,
  };
  const next: PatientAffectState = {
    trust: clampAffect(previous.trust + delta.trust),
    anxiety: clampAffect(previous.anxiety + delta.anxiety),
    defensiveness: clampAffect(previous.defensiveness + delta.defensiveness),
  };
  return { intent, previous, delta, next };
}

export function applyIntentSequence(
  initial: PatientAffectState,
  intents: readonly DoctorIntentCategory[],
  variant: FsmVariant = "standard",
): { final: PatientAffectState; steps: FsmTransitionResult[] } {
  const steps: FsmTransitionResult[] = [];
  let state = clampAffectState(initial);
  for (const intent of intents) {
    const step = transitionAffectState(state, intent, variant);
    steps.push(step);
    state = step.next;
  }
  return { final: state, steps };
}

/**
 * Choose intents that are allowed to move the FSM.
 * LLM labels below {@link LLM_INTENT_CONFIDENCE_THRESHOLD} (or invalid / non-finite
 * confidence) are discarded — the caller supplies a lexical or NEUTRAL fallback.
 * Never returns a below-threshold category: that would apply marked ΔT/ΔA/ΔD.
 */
export function selectTurnIntents(
  classified: ClassifiedIntent[] | undefined,
  fallback: DoctorIntentCategory,
): DoctorIntentCategory[] {
  if (!classified || classified.length === 0) return [fallback];
  const highConfidence = [...classified]
    .filter(
      (row) =>
        isDoctorIntentCategory(row.category) &&
        Number.isFinite(row.confidence) &&
        row.confidence >= LLM_INTENT_CONFIDENCE_THRESHOLD,
    )
    .sort((a, b) => b.confidence - a.confidence);
  if (highConfidence.length === 0) return [fallback];
  if (areHighConfidenceIntentsAmbiguous(highConfidence)) return [fallback];
  return highConfidence.map((row) => row.category);
}

const OPPOSING_INTENT_PAIRS: ReadonlyArray<readonly [DoctorIntentCategory, DoctorIntentCategory]> = [
  ["PATERNALISTIC_COMMAND", "VALIDATION"],
  ["PATERNALISTIC_COMMAND", "EMPATHIC_EXPLORATION"],
  ["PATERNALISTIC_COMMAND", "OPTION_ELICITATION"],
  ["DEFENSIVE_REACTION", "CLINICAL_DISCLOSURE"],
  ["FORMULAIC_EMPATHY", "VALIDATION"],
  ["EMOTIONAL_BYPASS", "VALIDATION"],
  ["EMOTIONAL_BYPASS", "EMPATHIC_EXPLORATION"],
];

/**
 * Two high-confidence labels of opposite polarity with similar scores are treated
 * as an ambiguous LLM output and must not drive the FSM.
 */
export function areHighConfidenceIntentsAmbiguous(intents: readonly ClassifiedIntent[]): boolean {
  if (intents.length < 2) return false;
  const ranked = [...intents].sort((a, b) => b.confidence - a.confidence);
  const top = ranked[0];
  const second = ranked[1];
  if (!top || !second) return false;
  if (Math.abs(top.confidence - second.confidence) > 0.1) return false;
  const pair = new Set([top.category, second.category]);
  return OPPOSING_INTENT_PAIRS.some(([a, b]) => pair.has(a) && pair.has(b));
}

export function countIntentCategories(
  intents: readonly DoctorIntentCategory[],
): Record<DoctorIntentCategory, number> {
  const counts = {
    EMPATHIC_EXPLORATION: 0,
    PATERNALISTIC_COMMAND: 0,
    VALIDATION: 0,
    DEFENSIVE_REACTION: 0,
    CLINICAL_DISCLOSURE: 0,
    DISCORDANCE: 0,
    FORMULAIC_EMPATHY: 0,
    EMOTIONAL_BYPASS: 0,
    OPTION_ELICITATION: 0,
    NEUTRAL: 0,
  } satisfies Record<DoctorIntentCategory, number>;
  for (const intent of intents) counts[intent] += 1;
  return counts;
}

export type RelationalFrameworkScores = {
  spikes: number;
  rias: number;
  care: number;
  alliance: number;
  biasManagement: number;
  defensiveMedicine: number;
};

/**
 * CARE / SPIKES / RIAS from intent frequencies + FSM trajectory (no LLM numerics).
 */
export function scoreRelationalFrameworks(params: {
  intents: readonly DoctorIntentCategory[];
  initial: PatientAffectState;
  final: PatientAffectState;
  variant?: FsmVariant;
}): RelationalFrameworkScores {
  const counts = countIntentCategories(params.intents);
  const total = Math.max(1, params.intents.length);
  const engaged = params.intents.length > 0;

  const spikesSteps = [
    engaged,
    counts.EMPATHIC_EXPLORATION > 0 || counts.OPTION_ELICITATION > 0,
    counts.EMPATHIC_EXPLORATION > 0,
    counts.CLINICAL_DISCLOSURE > 0,
    counts.VALIDATION > 0,
    counts.EMPATHIC_EXPLORATION + counts.CLINICAL_DISCLOSURE + counts.VALIDATION + counts.OPTION_ELICITATION >= 2,
  ];
  let spikes = Math.round((spikesSteps.filter(Boolean).length / 6) * 100);
  spikes -= counts.PATERNALISTIC_COMMAND * 18;
  spikes -= counts.DISCORDANCE * 10;
  spikes -= counts.EMOTIONAL_BYPASS * 14;
  spikes -= counts.FORMULAIC_EMPATHY * 8;
  if (counts.VALIDATION > 0) spikes += 8;
  if (counts.OPTION_ELICITATION > 0) spikes += 6;

  const socio =
    counts.VALIDATION + counts.EMPATHIC_EXPLORATION + counts.OPTION_ELICITATION;
  const task = counts.CLINICAL_DISCLOSURE + counts.NEUTRAL;
  const hostile =
    counts.PATERNALISTIC_COMMAND + counts.DISCORDANCE + counts.EMOTIONAL_BYPASS;
  const socioRatio = socio / total;
  const balance = task === 0 && socio === 0 ? 0 : 1 - Math.abs(socioRatio - 0.45);
  let rias = Math.round(socioRatio * 55 + balance * 35);
  rias -= hostile * 16;
  rias -= counts.FORMULAIC_EMPATHY * 6;

  const listened = counts.EMPATHIC_EXPLORATION > 0 ? 25 : 0;
  const explained = counts.CLINICAL_DISCLOSURE > 0 ? 22 : 0;
  const cared = counts.VALIDATION > 0 ? 28 : 0;
  const helped =
    counts.OPTION_ELICITATION > 0
      ? 15
      : counts.EMPATHIC_EXPLORATION > 1
        ? 15
        : counts.EMPATHIC_EXPLORATION > 0
          ? 8
          : 0;
  const trustGain = Math.max(0, params.final.trust - params.initial.trust);
  let care =
    listened + explained + cared + helped + Math.min(18, Math.round(trustGain * 0.35));
  if (counts.PATERNALISTIC_COMMAND > 0) care -= 22;
  if (counts.DISCORDANCE > 0) care -= 12;
  if (counts.EMOTIONAL_BYPASS > 0) care -= 16;
  care -= counts.FORMULAIC_EMPATHY * 10;
  if (params.final.trust < 35) care = Math.min(care, 42);

  const allianceLevel =
    params.final.trust * 0.5 +
    (100 - params.final.defensiveness) * 0.3 +
    (100 - params.final.anxiety) * 0.2;
  const improvement = Math.max(
    -20,
    Math.min(
      25,
      (params.final.trust -
        params.initial.trust +
        (params.initial.defensiveness - params.final.defensiveness)) *
        0.35,
    ),
  );
  const alliance = engaged ? clampAffect(allianceLevel + improvement) : 0;

  const cyber = params.variant === "cyberchondria";
  const anxietyDrop = params.initial.anxiety - params.final.anxiety;
  const defDrop = params.initial.defensiveness - params.final.defensiveness;
  let bias: number;
  if (cyber) {
    bias = 28;
    bias += Math.min(24, counts.VALIDATION * 10);
    bias += Math.min(16, counts.EMPATHIC_EXPLORATION * 7);
    bias += Math.min(18, counts.CLINICAL_DISCLOSURE * 8);
    bias += Math.min(12, counts.OPTION_ELICITATION * 8);
    bias -= counts.PATERNALISTIC_COMMAND * 22;
    bias -= counts.DEFENSIVE_REACTION * 14;
    bias -= counts.DISCORDANCE * 10;
    bias -= counts.EMOTIONAL_BYPASS * 14;
    bias -= counts.FORMULAIC_EMPATHY * 8;
    bias += Math.min(16, Math.round(Math.max(0, anxietyDrop) * 0.25));
    bias += Math.min(12, Math.round(Math.max(0, defDrop) * 0.2));
    if (counts.PATERNALISTIC_COMMAND === 0 && counts.VALIDATION > 0 && counts.CLINICAL_DISCLOSURE > 0) {
      bias += 10;
    }
  } else {
    bias =
      62 +
      counts.VALIDATION * 8 +
      counts.EMPATHIC_EXPLORATION * 5 +
      counts.CLINICAL_DISCLOSURE * 4 +
      counts.OPTION_ELICITATION * 7;
    bias -= counts.PATERNALISTIC_COMMAND * 18;
    bias -= counts.DEFENSIVE_REACTION * 8;
    bias -= counts.DISCORDANCE * 10;
    bias -= counts.EMOTIONAL_BYPASS * 14;
    bias -= counts.FORMULAIC_EMPATHY * 8;
  }

  let defensiveMedicine =
    78 -
    counts.DEFENSIVE_REACTION * 28 +
    Math.min(12, counts.CLINICAL_DISCLOSURE * 4) +
    Math.min(10, (counts.VALIDATION + counts.EMPATHIC_EXPLORATION) * 3);
  if (counts.DEFENSIVE_REACTION === 0 && counts.VALIDATION + counts.EMPATHIC_EXPLORATION > 0) {
    defensiveMedicine += 8;
  }

  return {
    spikes: engaged ? clampAffect(spikes) : 0,
    rias: engaged ? clampAffect(rias) : 0,
    care: engaged ? clampAffect(care) : 0,
    alliance: engaged ? clampAffect(alliance) : 0,
    biasManagement: engaged ? clampAffect(bias) : 0,
    defensiveMedicine: engaged ? clampAffect(defensiveMedicine) : 0,
  };
}

export function compositeDRimeScore(scores: RelationalFrameworkScores, engaged: boolean): number {
  if (!engaged) return 0;
  return clampAffect(
    Math.round(scores.alliance * 0.4 + scores.biasManagement * 0.3 + scores.defensiveMedicine * 0.3),
  );
}

/** Structural empathy ceiling when students game the system with canned phrases. */
export const EMPATHY_STRUCTURAL_SCORE_CAP = 75;
/** Cap fires when FORMULAIC_EMPATHY count is strictly greater than this. */
export const FORMULAIC_EMPATHY_CAP_THRESHOLD = 2;

export type EmpathyStructuralCapResult = {
  score: number;
  capped: boolean;
  reasons: string[];
};

/**
 * Hard ceiling on the composite D-RIME score.
 * - more than 2 FORMULAIC_EMPATHY acts → max 75
 * - no OPTION_ELICITATION when a therapy/prescription decision was required → max 75
 */
export function applyEmpathyStructuralCap(params: {
  score: number;
  intents: readonly DoctorIntentCategory[];
  therapyDecisionRequired: boolean;
}): EmpathyStructuralCapResult {
  const raw = Number.isFinite(params.score) ? params.score : 0;
  const counts = countIntentCategories(params.intents);
  const reasons: string[] = [];
  if (counts.FORMULAIC_EMPATHY > FORMULAIC_EMPATHY_CAP_THRESHOLD) {
    reasons.push(
      `Empatia formulaica ripetuta (${counts.FORMULAIC_EMPATHY} > ${FORMULAIC_EMPATHY_CAP_THRESHOLD})`,
    );
  }
  if (params.therapyDecisionRequired && counts.OPTION_ELICITATION === 0) {
    reasons.push(
      "Decisione terapeutica senza OPTION_ELICITATION (shared decision making assente)",
    );
  }
  if (reasons.length === 0) {
    return { score: clampAffect(raw), capped: false, reasons };
  }
  const capped = Math.min(clampAffect(raw), EMPATHY_STRUCTURAL_SCORE_CAP);
  return { score: capped, capped: true, reasons };
}
