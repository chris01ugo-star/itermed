import type { ExamClinicalMeta } from "@/lib/exam-default-values";
import { EXAM_DEFAULT_VALUES } from "@/lib/exam-default-values";
import { formatNormalRange } from "@/lib/exams/exam-range-utils";
import { ensureExamMetadataSeeded, getCaseExamValuesMap, listExamMetadata } from "@/lib/exams/exam-repository";
import type { CaseExamOverride } from "@/lib/exam-values-meta";

export type { CaseExamOverride } from "@/lib/exam-values-meta";

function metadataToClinicalMeta(row: {
  baseCost: number;
  baseTurnaroundMinutes: number;
  urgencyTiming: string;
  routineTiming: string;
  normalFindingText: string;
  normalRangeMin: number | null;
  normalRangeMax: number | null;
  unit: string;
}): ExamClinicalMeta {
  const rangeText =
    row.normalFindingText?.trim() ||
    formatNormalRange(row.normalRangeMin, row.normalRangeMax, row.unit);

  return {
    price: row.baseCost,
    routineMinutes: row.baseTurnaroundMinutes,
    urgencyTiming: row.urgencyTiming,
    routineTiming: row.routineTiming,
    normalFinding: rangeText,
  };
}

/** Enterprise catalog: ExamMetadata table with legacy fallback. */
export async function getExamValuesCatalog(): Promise<Record<string, ExamClinicalMeta>> {
  try {
    await ensureExamMetadataSeeded();
    const rows = await listExamMetadata();
    if (rows.length === 0) return EXAM_DEFAULT_VALUES;

    const catalog: Record<string, ExamClinicalMeta> = { ...EXAM_DEFAULT_VALUES };
    for (const row of rows) {
      catalog[row.id] = metadataToClinicalMeta(row);
    }
    return catalog;
  } catch {
    return EXAM_DEFAULT_VALUES;
  }
}

/** Case-specific values merged: CaseExamValue (DB) + legacy JSON baseline. */
export async function getCaseExamOverrides(
  caseId: string,
  baselineExamFindings?: unknown,
): Promise<Record<string, CaseExamOverride>> {
  const legacy = extractLegacyCaseOverrides(baselineExamFindings);
  let dbOverrides: Record<string, CaseExamOverride> = {};

  try {
    const dbMap = await getCaseExamValuesMap(caseId);
    dbOverrides = Object.fromEntries(
      Object.entries(dbMap).map(([examId, row]) => [
        examId,
        {
          price: row.customCost,
          customCost: row.customCost,
          value: row.value,
          isAbnormal: row.isAbnormal,
          normalFinding:
            row.value != null
              ? `${row.value}${row.isAbnormal ? " (patologico)" : ""}`
              : undefined,
        } satisfies CaseExamOverride,
      ]),
    );
  } catch {
    // DB unavailable — legacy only.
  }

  const merged: Record<string, CaseExamOverride> = { ...legacy };
  for (const [examId, dbRow] of Object.entries(dbOverrides)) {
    const previous = merged[examId];
    const dbHasText = Boolean(dbRow.normalFinding?.trim()) || dbRow.value != null;
    merged[examId] = dbHasText
      ? { ...previous, ...dbRow }
      : { ...dbRow, ...previous, normalFinding: previous?.normalFinding };
  }
  return merged;
}

function extractLegacyCaseOverrides(
  baselineExamFindings?: unknown,
): Record<string, CaseExamOverride> {
  const bf =
    baselineExamFindings &&
    typeof baselineExamFindings === "object" &&
    !Array.isArray(baselineExamFindings)
      ? (baselineExamFindings as Record<string, unknown>)
      : null;
  if (!bf) return {};

  const fromAdvanced =
    bf.advancedExams &&
    typeof bf.advancedExams === "object" &&
    !Array.isArray(bf.advancedExams)
      ? ((bf.advancedExams as { values?: Record<string, CaseExamOverride> }).values ?? {})
      : {};

  const reserved = new Set([
    "vitals",
    "demographics",
    "advancedExams",
    "examBudgetEuro",
    "stressProfile",
    "physicalExam",
    "thorax",
    "abdomen",
    "neuro",
  ]);

  const fromTopLevel: Record<string, CaseExamOverride> = {};
  for (const [key, value] of Object.entries(bf)) {
    if (reserved.has(key) || fromAdvanced[key]) continue;
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const row = value as Record<string, unknown>;
    const finding =
      typeof row.finding === "string"
        ? row.finding
        : typeof row.normalFinding === "string"
          ? row.normalFinding
          : null;
    if (!finding?.trim()) continue;
    fromTopLevel[key] = {
      normalFinding: finding.trim(),
      isAbnormal: row.isAbnormal === true,
      ...(typeof row.price === "number" ? { price: row.price } : {}),
      ...(typeof row.customCost === "number" ? { customCost: row.customCost } : {}),
    };
  }

  return { ...fromTopLevel, ...fromAdvanced };
}
