/**
 * Shared cross-session cache key for baseline exam reports.
 * Bump when the exam-report prompt changes so old rows are ignored.
 */
export const EXAM_REPORT_CACHE_PROMPT_VERSION = "v1";

export const EXAM_CACHE_BASELINE_KEY = "baseline" as const;

export type ExamCacheContextKey = typeof EXAM_CACHE_BASELINE_KEY;

/**
 * Physiology-changing therapy. Diagnostic maneuvers (auscultation, GCS, pupils,
 * inspection, palpation) are intentionally absent.
 */
const PHYSIOLOGY_ALTERING_INTERVENTION =
  /ossigen|oxygen|\bo2\b|venturi|cpap|\bniv\b|nimv|hfnc|ventilaz|intubaz|fluidi|\bfluid\b|infusion|cristalloid|colloide|riempiment|fisiologic|ringer|analges|morfin|fentanyl|ketamin|paracetamol|fans\b|tachipirin|oppioid|defibrill|cardiovers|shock\s*elettr|trasfusion|emocomponent|emazie|piastrin|\bplasma\b|sacca/i;

export type ExamCacheContextInput = {
  repeatCount: number;
  deteriorationTriggered: boolean;
  prescribedDrugs: readonly string[];
  executedInterventions: readonly string[];
};

export function isPhysiologyAlteringIntervention(label: string): boolean {
  const text = label.trim();
  if (!text) return false;
  return PHYSIOLOGY_ALTERING_INTERVENTION.test(text);
}

/**
 * "baseline" only on the first request, before deterioration, drugs, or
 * physiology-altering interventions. Otherwise null: skip the shared cache.
 */
export function buildExamCacheContextKey(input: ExamCacheContextInput): ExamCacheContextKey | null {
  if (input.repeatCount !== 0) return null;
  if (input.deteriorationTriggered !== false) return null;
  if (input.prescribedDrugs.length !== 0) return null;
  if (input.executedInterventions.some((item) => isPhysiologyAlteringIntervention(item))) return null;
  return EXAM_CACHE_BASELINE_KEY;
}

export type ExamReportCachePlan =
  | { examCache: "session"; llmCalls: 0 }
  | { examCache: "shared_hit"; llmCalls: 0; contextKey: ExamCacheContextKey }
  | { examCache: "miss"; llmCalls: 1; contextKey: ExamCacheContextKey | null };

/**
 * Resolution order: session override, then shared baseline row, then one LLM call.
 * A shared row is used only when the context key is baseline.
 */
export function planExamReportCache(
  input: ExamCacheContextInput & {
    sessionHit: boolean;
    sharedRowPresent: boolean;
  },
): ExamReportCachePlan {
  if (input.sessionHit) return { examCache: "session", llmCalls: 0 };
  const contextKey = buildExamCacheContextKey(input);
  if (contextKey === EXAM_CACHE_BASELINE_KEY && input.sharedRowPresent) {
    return { examCache: "shared_hit", llmCalls: 0, contextKey };
  }
  return { examCache: "miss", llmCalls: 1, contextKey };
}

export function resolveExamRepeatCount(input: {
  clientRepeatCount?: number;
  sessionRequestedExamIds: readonly string[];
  examId: string;
}): number {
  if (typeof input.clientRepeatCount === "number" && Number.isFinite(input.clientRepeatCount)) {
    return Math.max(0, Math.trunc(input.clientRepeatCount));
  }
  return input.sessionRequestedExamIds.filter((id) => id === input.examId).length;
}

/** A persisted request of the same exam counts even if the client still says zero. */
export function conservativeExamRepeatCount(input: {
  clientRepeatCount?: number;
  sessionRequestedExamIds: readonly string[];
  examId: string;
}): number {
  const declared = resolveExamRepeatCount(input);
  const persisted = input.sessionRequestedExamIds.filter((id) => id === input.examId).length;
  return Math.max(declared, persisted);
}

export function mergePrescribedDrugLabels(
  sessionDrugs: readonly string[],
  clientDrugs: readonly string[] | undefined,
): string[] {
  const labels: string[] = [];
  for (const raw of [...sessionDrugs, ...(clientDrugs ?? [])]) {
    const label = raw.trim();
    if (label) labels.push(label);
  }
  return labels;
}
