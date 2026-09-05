import { EXAM_DEFAULT_VALUES, type ExamClinicalMeta } from "@/lib/exam-default-values";

export type CaseExamOverride = {
  price?: number | null;
  customCost?: number | null;
  urgencyTiming?: string | null;
  routineTiming?: string | null;
  normalFinding?: string | null;
  finding?: string | null;
  routineMinutes?: number | null;
  value?: number | null;
  isAbnormal?: boolean;
};

export function resolveExamClinicalMeta(
  examId: string,
  catalog: Record<string, ExamClinicalMeta>,
  caseOverride?: CaseExamOverride | null,
): ExamClinicalMeta | null {
  const base = catalog[examId] ?? EXAM_DEFAULT_VALUES[examId];
  if (!base && !caseOverride) return null;

  const fallback: ExamClinicalMeta = base ?? {
    price: 0,
    urgencyTiming: "n.p.",
    routineTiming: "n.p.",
    routineMinutes: 0,
    normalFinding: "",
  };

  return {
    price: caseOverride?.customCost ?? caseOverride?.price ?? fallback.price,
    urgencyTiming: caseOverride?.urgencyTiming ?? fallback.urgencyTiming,
    routineTiming: caseOverride?.routineTiming ?? fallback.routineTiming,
    routineMinutes: caseOverride?.routineMinutes ?? fallback.routineMinutes,
    normalFinding: caseOverride?.normalFinding?.trim() || fallback.normalFinding,
  };
}
