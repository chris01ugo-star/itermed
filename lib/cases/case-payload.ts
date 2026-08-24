type CaseNodeContent = { casePrompt?: string };

const DEFAULT_PATIENT_PROMPT =
  "Paziente in simulazione. Rispondi come paziente, senza diagnosi e senza valori vitali a voce.";

/**
 * Keys that encode gold-path, scoring, or evaluation ground truth.
 * Must never appear in a play-session payload (RSC props, JSON APIs, fallback).
 */
export const PLAY_SESSION_FORBIDDEN_KEYS = [
  "goldStandardPath",
  "goldPath",
  "goldPathNarrative",
  "correctSolution",
  "diagnosis",
  "trueDiagnosis",
  "anamnesisQuestions",
  "mandatoryExams",
  "inappropriateExams",
  "legalConformity",
  "escCitations",
  "auditMetrics",
  "patientProfile",
  "ragSources",
  "ragReferences",
  "ragSourceRefs",
  "expectedKeywords",
  "legalCriteria",
  "appropriatenessIndicators",
] as const;

const FORBIDDEN_KEY_SET = new Set<string>(PLAY_SESSION_FORBIDDEN_KEYS);

const STRESS_PROFILE_ALLOWED_KEYS = new Set([
  "initialStress",
  "reactivityType",
  "timeDecayRate",
]);

/** Safely extract the virtual-patient prompt from a CaseNode.content JSON blob. */
export function extractPatientPromptFromNode(
  content: unknown,
  fallback: string = DEFAULT_PATIENT_PROMPT,
): string {
  if (!content || typeof content !== "object" || Array.isArray(content)) {
    return fallback;
  }
  const prompt = (content as CaseNodeContent).casePrompt;
  if (typeof prompt === "string" && prompt.trim()) {
    return prompt.trim();
  }
  return fallback;
}

/** Coerce baselineExamFindings JSON into a plain object (never throws). */
export function asBaselineRecord(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }
  return raw as Record<string, unknown>;
}

export function extractDemographics(baseline: Record<string, unknown>): {
  age: number | string | null;
  sex: string | null;
  context: string | null;
} {
  const demographics =
    baseline.demographics &&
    typeof baseline.demographics === "object" &&
    !Array.isArray(baseline.demographics)
      ? (baseline.demographics as Record<string, unknown>)
      : {};

  const age = demographics.age;
  const sex = demographics.sex;
  const context = demographics.context;

  return {
    age: typeof age === "number" || typeof age === "string" ? age : null,
    sex: typeof sex === "string" ? sex : null,
    context: typeof context === "string" ? context : null,
  };
}

function sanitizeStressProfileForClient(raw: unknown): Record<string, unknown> | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const src = raw as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of STRESS_PROFILE_ALLOWED_KEYS) {
    if (src[key] !== undefined) out[key] = src[key];
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * Zero-trust baseline: vitals, demographics, physical findings, exam result library.
 * Strips gold path, scoring checklists, legal keys, and stress milestones that encode expected actions.
 */
export function sanitizeBaselineForClient(raw: unknown): Record<string, unknown> {
  const baseline = asBaselineRecord(raw);
  const out: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(baseline)) {
    if (FORBIDDEN_KEY_SET.has(key)) continue;
    if (key === "stressProfile") {
      const stress = sanitizeStressProfileForClient(value);
      if (stress) out.stressProfile = stress;
      continue;
    }
    out[key] = value;
  }

  return out;
}

/** Recursively lists forbidden evaluation keys found in a client-bound payload. */
export function findPlaySessionEvaluationLeaks(value: unknown, path = "$"): string[] {
  const leaks: string[] = [];
  if (value == null) return leaks;

  if (Array.isArray(value)) {
    value.forEach((item, i) => {
      leaks.push(...findPlaySessionEvaluationLeaks(item, `${path}[${i}]`));
    });
    return leaks;
  }

  if (typeof value !== "object") return leaks;

  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    const here = `${path}.${key}`;
    if (FORBIDDEN_KEY_SET.has(key)) {
      leaks.push(here);
      continue;
    }
    leaks.push(...findPlaySessionEvaluationLeaks(nested, here));
  }
  return leaks;
}

/**
 * Play-session DTO sent to SimulatorClient (RSC props) and JSON case APIs.
 * Intentionally omits goldStandardPath, correctSolution, and scoring metadata.
 */
export type SimulatorPlayCasePayload = {
  id: string;
  title: string;
  description: string;
  specialty: string | null;
  difficulty: string;
  estimatedDurationMinutes: number | null;
  patientPrompt: string;
  demographics: {
    age: number | string | null;
    sex: string | null;
    context: string | null;
  };
  baselineExamFindings: Record<string, unknown>;
  timeLimitMinutes: number | null;
};

export type BuildSimulatorCasePayloadInput = {
  id: string;
  title: string;
  description: string;
  specialty: string | null;
  difficulty: string;
  estimatedDurationMinutes: number | null;
  patientPrompt: string;
  baselineExamFindings: unknown;
  timeLimitMinutes?: number | null;
  /**
   * Accepted so callers can pass a Prisma row without leaking it.
   * Never copied onto the returned DTO.
   */
  examLatencies?: unknown;
  goldStandardPath?: unknown;
  patientDeteriorationThreshold?: number | null;
  correctSolution?: unknown;
};

/**
 * Builds the SimulatorClient play payload.
 * Gold path / correctSolution / scoring keys are stripped even if present on the input row.
 */
export function buildSimulatorCasePayload(
  params: BuildSimulatorCasePayloadInput,
): SimulatorPlayCasePayload {
  const baseline = sanitizeBaselineForClient(params.baselineExamFindings);
  const demographics = extractDemographics(baseline);

  const payload: SimulatorPlayCasePayload = {
    id: params.id,
    title: params.title,
    description: params.description,
    specialty: params.specialty ?? null,
    difficulty: params.difficulty,
    estimatedDurationMinutes: params.estimatedDurationMinutes ?? null,
    patientPrompt: params.patientPrompt || DEFAULT_PATIENT_PROMPT,
    demographics,
    baselineExamFindings: baseline,
    timeLimitMinutes: params.timeLimitMinutes ?? null,
  };

  return payload;
}
