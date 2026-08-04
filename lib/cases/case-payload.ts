import {
  parseExamLatencies,
  parseGoldStandardPath,
} from "@/lib/cases/simulation-time";

type CaseNodeContent = { casePrompt?: string };

const DEFAULT_PATIENT_PROMPT =
  "Paziente in simulazione. Rispondi come paziente, senza diagnosi e senza valori vitali a voce.";

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

/**
 * Builds the SimulatorClient `initialCaseData` shape from a Prisma clinical case row.
 * Always strips `correctSolution` from the client payload.
 *
 * For beta JSON ingest, gate with `assertPlayableCase` from `@/lib/cases/case-import-schema`
 * before writing to the DB.
 */
export function buildSimulatorCasePayload(params: {
  id: string;
  title: string;
  description: string;
  specialty: string | null;
  difficulty: string;
  estimatedDurationMinutes: number | null;
  patientPrompt: string;
  baselineExamFindings: unknown;
  timeLimitMinutes?: number | null;
  examLatencies?: unknown;
  goldStandardPath?: unknown;
  patientDeteriorationThreshold?: number | null;
}) {
  const baseline = asBaselineRecord(params.baselineExamFindings);
  const demographics = extractDemographics(baseline);

  return {
    id: params.id,
    title: params.title,
    description: params.description,
    specialty: params.specialty ?? null,
    difficulty: params.difficulty,
    estimatedDurationMinutes: params.estimatedDurationMinutes ?? null,
    patientPrompt: params.patientPrompt || DEFAULT_PATIENT_PROMPT,
    correctSolution: null as string | null,
    demographics,
    baselineExamFindings: baseline,
    timeLimitMinutes: params.timeLimitMinutes ?? null,
    examLatencies: (() => {
      const parsed = parseExamLatencies(params.examLatencies);
      return Object.keys(parsed).length > 0 ? parsed : null;
    })(),
    goldStandardPath: (() => {
      const path = parseGoldStandardPath(params.goldStandardPath);
      return path.length > 0 ? path : null;
    })(),
    patientDeteriorationThreshold: params.patientDeteriorationThreshold ?? null,
  };
}
