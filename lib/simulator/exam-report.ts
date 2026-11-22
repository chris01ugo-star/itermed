import { z } from "zod";
import { EXAM_CATALOG_STRUCTURE } from "@/lib/exam-catalog-structure";

/** Player-facing structured report. Ground truth never travels in this object. */
export const EXAM_REPORT_CATEGORIES = [
  "lab",
  "ega",
  "ecg",
  "imaging",
  "microbiology",
  "other",
] as const;

export type ExamReportCategory = (typeof EXAM_REPORT_CATEGORIES)[number];

export const EXAM_REPORT_FLAGS = ["H", "L", "N", "CRITICAL"] as const;
export type ExamReportFlag = (typeof EXAM_REPORT_FLAGS)[number];

export const examReportParameterSchema = z.object({
  name: z.string(),
  value: z.string(),
  unit: z.string(),
  referenceRange: z.string(),
  flag: z.enum(EXAM_REPORT_FLAGS),
});

export const examReportSectionSchema = z.object({
  heading: z.string(),
  content: z.string(),
});

/**
 * Strict-mode friendly: every key is required. Absent panels are `null`,
 * never omitted (OpenAI rejects optional object keys).
 */
export const examReportObjectSchema = z.object({
  title: z.string(),
  category: z.enum(EXAM_REPORT_CATEGORIES),
  isAbnormal: z.boolean(),
  summary: z.string(),
  parameters: z.array(examReportParameterSchema).max(32).nullable(),
  sections: z.array(examReportSectionSchema).max(8).nullable(),
  formattedText: z.string(),
});

export type ExamReportParameter = z.infer<typeof examReportParameterSchema>;
export type ExamReportSection = z.infer<typeof examReportSectionSchema>;
export type ClinicalExamReport = z.infer<typeof examReportObjectSchema>;

export type StoredExamReport = ClinicalExamReport & {
  generatedByEngine: true;
  examId: string;
  /** Same text as `formattedText`, for readers that expect a finding string. */
  finding: string;
};

const NON_CLINICAL_ANCHOR =
  /spreco\s+ssn|non di prima intenzione|nomenclatore|\btariffa\b|\bcodice\s+(?:prestazione|nomenclatore|ssa)\b|come scrive\s+(?:gold|esc|aha|nice|gina|ers)\b|linee?\s+guida|secondo\s+(?:le\s+)?(?:linee\s+guida|gold|esc|aha|nice)\b|€\s*\d|\bprezzo\b|\bnon autorizza\b|\bè vietat\w*\b|\bcontroindicat\w*\b|\bfatal(?:e|if)\b/i;

const PLAYER_LEAK =
  /spreco\s+ssn|non di prima intenzione|nomenclatore|\btariffa\b|come scrive\s+\w+|linee?\s+guida|\bsi consiglia\b|\bsomministrare\b|\biniziare\s+(?:subito\s+)?(?:la\s+)?(?:terapia|trattamento)\b|\bdiagnosi\s*(?:finale|clinica)?\s*:/i;

const EXAM_CATEGORY_BY_ID = new Map<string, ExamReportCategory>();
for (const macro of EXAM_CATALOG_STRUCTURE) {
  for (const group of macro.groups) {
    for (const exam of group.exams) {
      let category: ExamReportCategory = "other";
      if (exam.id === "ega") category = "ega";
      else if (exam.id === "ecg") category = "ecg";
      else if (macro.id === "lab" && group.id === "micro") category = "microbiology";
      else if (macro.id === "lab") category = "lab";
      else if (macro.id === "img") category = "imaging";
      EXAM_CATEGORY_BY_ID.set(exam.id, category);
    }
  }
}

export function inferExamReportCategory(
  examId: string,
  examName?: string,
  hint?: string | null,
): ExamReportCategory | null {
  const known = EXAM_CATEGORY_BY_ID.get(examId.trim());
  if (known) return known;

  const blob = `${examId} ${examName ?? ""} ${hint ?? ""}`.toLowerCase();
  if (/\bega\b|emogas/.test(blob)) return "ega";
  if (/\becg\b|elettrocardiog/.test(blob)) return "ecg";
  if (/emocoltur|urinocolt|coprocult|tampone|microbiolog|antibiogram/.test(blob)) {
    return "microbiology";
  }
  if (
    /\b(rx|tc|tac|rm|rmn|pet|ecograf|eco |fast|scintigraf|mammograf|angio)\b/.test(blob)
  ) {
    return "imaging";
  }
  if (
    hint === "lab" ||
    /\b(emocromo|pcr|troponin|creatinin|lattat|glicem|elettrolit)\b/.test(blob)
  ) {
    return "lab";
  }
  if (hint && (EXAM_REPORT_CATEGORIES as readonly string[]).includes(hint)) {
    return hint as ExamReportCategory;
  }
  return null;
}

function splitSentences(text: string): string[] {
  return text
    .split(/\n+|(?<=[.!;])\s+(?=[A-ZÀ-Ý0-9])/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function tidyInline(text: string): string {
  return text
    .replace(/\s*\(\s*(?:CARDIO|PNEUMO|GASTRO|NEURO|ENDO|LABO)-\d+\s*\)/gi, "")
    .replace(/,?\s*tipic[oa]\s+(?:in|di)\s+[^.;\n]+/gi, "")
    .replace(/,?\s*indicativ[oa]\s+di\s+[^.;\n]+/gi, "")
    .replace(/,?\s*suggestiv[oa]\s+di\s+[^.;\n]+/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.;:])/g, "$1")
    .trim();
}

/**
 * Drops authored meta-comments (SSN waste, tariffs, guideline citations)
 * while keeping numeric and pathologic findings in the same anchor.
 */
export function stripNonClinicalAnchors(raw: string): string {
  const blocks = raw.split(/\n{2,}/);
  const cleaned = blocks
    .map((block) => {
      const pieces = block.split("\n").flatMap((line) => splitSentences(line));
      return pieces
        .map((sentence) => tidyInline(sentence))
        .filter((sentence) => sentence.length > 0 && !NON_CLINICAL_ANCHOR.test(sentence))
        .join(" ");
    })
    .filter((block) => block.length > 0);
  return cleaned.join("\n\n").trim();
}

/** Removes tariff, guideline and therapeutic leaks from text shown to the physician. */
export function scrubPlayerReportText(raw: string): string {
  const blocks = raw.split(/\n{2,}/);
  const cleaned = blocks
    .map((block) => {
      const pieces = block.split("\n").flatMap((line) => splitSentences(line));
      return pieces
        .map((sentence) => tidyInline(sentence))
        .filter(
          (sentence) =>
            sentence.length > 0 &&
            !NON_CLINICAL_ANCHOR.test(sentence) &&
            !PLAYER_LEAK.test(sentence),
        )
        .join(" ");
    })
    .filter((block) => block.length > 0);
  return cleaned.join("\n\n").trim();
}

export function isPlaceholderExamFinding(text: string | null | undefined): boolean {
  const value = text?.trim() ?? "";
  if (!value) return true;
  return /nessun valore definito/i.test(value);
}

function isCategory(value: unknown): value is ExamReportCategory {
  return (
    typeof value === "string" &&
    (EXAM_REPORT_CATEGORIES as readonly string[]).includes(value)
  );
}

function isFlag(value: unknown): value is ExamReportFlag {
  return typeof value === "string" && (EXAM_REPORT_FLAGS as readonly string[]).includes(value);
}

function readParameters(value: unknown): ExamReportParameter[] | null {
  if (!Array.isArray(value)) return null;
  const rows: ExamReportParameter[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    if (typeof row.name !== "string" || !row.name.trim()) continue;
    if (!isFlag(row.flag)) continue;
    rows.push({
      name: row.name.trim(),
      value: typeof row.value === "string" ? row.value.trim() : String(row.value ?? ""),
      unit: typeof row.unit === "string" ? row.unit.trim() : "",
      referenceRange:
        typeof row.referenceRange === "string" ? row.referenceRange.trim() : "",
      flag: row.flag,
    });
  }
  return rows.length > 0 ? rows : null;
}

function readSections(value: unknown): ExamReportSection[] | null {
  if (!Array.isArray(value)) return null;
  const rows: ExamReportSection[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    if (typeof row.heading !== "string" || !row.heading.trim()) continue;
    if (typeof row.content !== "string" || !row.content.trim()) continue;
    rows.push({ heading: row.heading.trim(), content: row.content.trim() });
  }
  return rows.length > 0 ? rows : null;
}

export function isClinicalExamReport(value: unknown): value is ClinicalExamReport {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.title === "string" &&
    row.title.trim().length > 0 &&
    isCategory(row.category) &&
    typeof row.isAbnormal === "boolean" &&
    typeof row.summary === "string" &&
    typeof row.formattedText === "string" &&
    row.formattedText.trim().length > 0
  );
}

export function readGeneratedExamReport(value: unknown): StoredExamReport | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (row.generatedByEngine !== true) return null;
  const examId = typeof row.examId === "string" ? row.examId.trim() : "";
  if (!examId || !isClinicalExamReport(row)) return null;
  const parameters = readParameters(row.parameters);
  const sections = readSections(row.sections);
  return {
    generatedByEngine: true,
    examId,
    title: row.title.trim(),
    category: row.category,
    isAbnormal: row.isAbnormal,
    summary: row.summary.trim(),
    parameters,
    sections,
    formattedText: row.formattedText.trim(),
    finding: row.formattedText.trim(),
  };
}

function clipSummary(text: string): string {
  const clean = scrubPlayerReportText(text).replace(/\s+/g, " ").trim();
  if (clean.length <= 420) return clean;
  const slice = clean.slice(0, 420);
  const lastStop = Math.max(slice.lastIndexOf(". "), slice.lastIndexOf("; "));
  const cut = lastStop > 180 ? slice.slice(0, lastStop + 1) : slice.trimEnd();
  return cut.replace(/[,:;]\s*$/, "").trim();
}

function composeFormattedText(report: {
  summary: string;
  parameters: ExamReportParameter[] | null;
  sections: ExamReportSection[] | null;
}): string {
  const parts: string[] = [];
  if (report.summary.trim()) parts.push(report.summary.trim());
  if (report.parameters?.length) {
    parts.push(
      report.parameters
        .map((row) => {
          const unit = row.unit ? ` ${row.unit}` : "";
          const range = row.referenceRange ? ` (rif. ${row.referenceRange})` : "";
          return `${row.name}: ${row.value}${unit}${range} [${row.flag}]`;
        })
        .join("\n"),
    );
  }
  if (report.sections?.length) {
    parts.push(
      report.sections.map((section) => `${section.heading}\n${section.content}`).join("\n\n"),
    );
  }
  return parts.join("\n\n").trim();
}

/** Normalizes model output before it is stored or shown. */
export function finalizeClinicalExamReport(
  raw: ClinicalExamReport,
  params: { examId: string; examName: string; category: ExamReportCategory | null },
): ClinicalExamReport {
  const category = params.category ?? raw.category;
  const parameters = (raw.parameters ?? [])
    .map((row) => ({
      name: scrubPlayerReportText(row.name) || row.name.trim(),
      value: scrubPlayerReportText(row.value) || row.value.trim(),
      unit: row.unit.trim(),
      referenceRange: scrubPlayerReportText(row.referenceRange) || row.referenceRange.trim(),
      flag: row.flag,
    }))
    .filter((row) => row.name.length > 0 && row.value.length > 0);

  const sections = (raw.sections ?? [])
    .map((section) => ({
      heading: scrubPlayerReportText(section.heading) || section.heading.trim(),
      content: scrubPlayerReportText(section.content),
    }))
    .filter((section) => section.heading.length > 0 && section.content.length > 0);

  const useParameters = category === "lab" || category === "ega" || category === "microbiology";
  const keptParameters = useParameters && parameters.length > 0 ? parameters : null;
  const keptSections =
    !useParameters || category === "microbiology"
      ? sections.length > 0
        ? sections
        : null
      : null;
  const sectionsForNarrative =
    category === "lab" || category === "ega" ? null : keptSections;

  const summary =
    clipSummary(raw.summary) ||
    (keptParameters?.some((row) => row.flag !== "N")
      ? "Si segnalano valori fuori dall'intervallo di riferimento."
      : "Referto nei limiti del metodo per i parametri refertati.");

  const abnormalFromFlags = keptParameters?.some((row) => row.flag !== "N") ?? false;
  const isAbnormal = keptParameters ? abnormalFromFlags : Boolean(raw.isAbnormal);

  const composed = composeFormattedText({
    summary,
    parameters: keptParameters,
    sections: sectionsForNarrative,
  });
  const scrubbedFormatted = scrubPlayerReportText(raw.formattedText);
  const formattedText =
    scrubbedFormatted.length >= 40 ? scrubbedFormatted : composed || scrubbedFormatted;

  return {
    title: scrubPlayerReportText(raw.title) || params.examName.trim() || params.examId,
    category,
    isAbnormal,
    summary,
    parameters: keptParameters,
    sections: sectionsForNarrative,
    formattedText: formattedText || summary,
  };
}

export function toStoredExamReport(
  report: ClinicalExamReport,
  examId: string,
): StoredExamReport {
  return {
    ...report,
    generatedByEngine: true,
    examId,
    finding: report.formattedText,
  };
}

/** Text block appended to the final evaluation context. Omits non-engine keys. */
export function formatGeneratedReportsForAudit(overrides: unknown): string {
  if (!overrides || typeof overrides !== "object" || Array.isArray(overrides)) return "";
  const blocks: string[] = [];
  for (const [examId, value] of Object.entries(overrides as Record<string, unknown>)) {
    const report = readGeneratedExamReport(value);
    if (!report) continue;
    blocks.push(`- ${report.title} (${examId})\n${report.formattedText}`);
  }
  const text = blocks.join("\n\n").trim();
  if (text.length <= 8000) return text;
  return `${text.slice(0, 8000).trimEnd()}\n[...]`;
}
