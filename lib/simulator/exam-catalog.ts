import type { ExamClinicalMeta } from "@/lib/exam-default-values";
import { resolveExamClinicalMeta, type CaseExamOverride } from "@/lib/exam-values-meta";
import {
  adaptFindingForRequestedExam,
  pickCaseFindingText,
  sanitizeExamFinding,
} from "@/lib/simulator/exam-finding-text";

export type SimulatorExam = {
  id: string;
  name: string;
  cost: number;
  timeMinutes: number;
  urgencyTiming?: string;
  routineTiming?: string;
  normalFinding?: string;
};

export type ExamGroup = { id: string; label: string; exams: SimulatorExam[] };
export type ExamMacroCategory = { id: string; label: string; groups: ExamGroup[] };

export function applyExamMeta(
  exam: SimulatorExam,
  catalog: Record<string, ExamClinicalMeta>,
  caseOverride?: CaseExamOverride | null,
): SimulatorExam {
  const meta = resolveExamClinicalMeta(exam.id, catalog, caseOverride);
  if (!meta) return exam;

  return {
    ...exam,
    cost: meta.price,
    timeMinutes: meta.routineMinutes,
    urgencyTiming: meta.urgencyTiming,
    routineTiming: meta.routineTiming,
    normalFinding: meta.normalFinding,
  };
}

export function buildExamMacroCatalog(
  rawCatalog: ExamMacroCategory[],
  catalog: Record<string, ExamClinicalMeta>,
): ExamMacroCategory[] {
  return rawCatalog.map((macro) => ({
    ...macro,
    groups: macro.groups.map((group) => ({
      ...group,
      exams: group.exams.map((exam) => applyExamMeta(exam, catalog)),
    })),
  }));
}

export function flattenExams(macroCatalog: ExamMacroCategory[]): SimulatorExam[] {
  return macroCatalog.flatMap((macro) => macro.groups.flatMap((group) => group.exams));
}

export function formatExamFinding(
  examId: string,
  catalog: Record<string, ExamClinicalMeta>,
  caseValues: Record<string, CaseExamOverride>,
): string {
  const override = caseValues[examId];
  if (override?.value != null) {
    const suffix = override.isAbnormal ? " — patologico" : "";
    return `${override.value}${suffix}`;
  }

  const picked = pickCaseFindingText(examId, caseValues);
  if (picked) {
    const sanitized = sanitizeExamFinding(examId, picked.text);
    const adapted = adaptFindingForRequestedExam(
      examId,
      picked.sourceId,
      sanitized || picked.text,
    );
    const report = sanitizeExamFinding(examId, adapted);
    if (report) return report;
  }

  const resolved = resolveExamClinicalMeta(examId, catalog, override);
  const catalogText = resolved?.normalFinding?.trim() ?? "";
  if (catalogText && !/da valutare|eseguire |iniziare |si consiglia/i.test(catalogText)) {
    return catalogText;
  }
  return "Nessun valore definito per questo esame (configura in admin o nel caso clinico).";
}
