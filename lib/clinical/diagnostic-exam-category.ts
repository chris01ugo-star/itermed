/**
 * Cartella clinica IA: Imaging vs Esami strumentali.
 * Catalog macro ids (`img` / `strum` / `endo`) are the SSOT; name/id heuristics
 * re-bucket mixed or legacy rows until every case is fully migrated.
 */

export const DIAGNOSTIC_EXAM_CATEGORIES = [
  "LAB",
  "IMAGING",
  "INSTRUMENTAL",
  "ENDOSCOPY",
  "OTHER",
] as const;

export type DiagnosticExamCategory = (typeof DIAGNOSTIC_EXAM_CATEGORIES)[number];

/** Tabs in the clinical chart (endoscopy sits with strumentale, not radiology). */
export type ChartDiagnosticSection = "imaging" | "instrumental";

export const MACRO_ID_TO_DIAGNOSTIC_CATEGORY: Record<string, DiagnosticExamCategory> = {
  lab: "LAB",
  img: "IMAGING",
  strum: "INSTRUMENTAL",
  endo: "ENDOSCOPY",
};

export const DIAGNOSTIC_CATEGORY_TO_MACRO_ID: Record<
  Exclude<DiagnosticExamCategory, "OTHER">,
  string
> = {
  LAB: "lab",
  IMAGING: "img",
  INSTRUMENTAL: "strum",
  ENDOSCOPY: "endo",
};

export type ChartExamLike = {
  id: string;
  name: string;
  diagnosticCategory?: DiagnosticExamCategory | null;
};

export type ChartCatalogGroup<T extends ChartExamLike = ChartExamLike> = {
  id: string;
  label: string;
  exams: T[];
};

export type ChartCatalogMacro<T extends ChartExamLike = ChartExamLike> = {
  id: string;
  label: string;
  groups: ChartCatalogGroup<T>[];
};

const INSTRUMENTAL_RE =
  /\b(ecg|holter|elettrocardiogramm?a?|eeg|elettroencefalogramm?a?|emg|elettromiograf\w*|spirometr\w*|emogas\w*|\bega\b|6mwt|test del cammino|polisonnograf\w*|audiometr\w*|fundus|potenziali evocati|abpm|monitoraggio pressorio|prova da sforzo|treadmill|ergometr\w*|ecocardio\w*|eco[\s-]?tt|eco[\s-]?te|\btte\b|\btee\b|coronarograf\w*)\b/i;

const ENDOSCOPY_RE =
  /\b(egds|gastroscop\w*|colonscop\w*|broncoscop\w*|cistoscop\w*|laringoscop\w*|endoscop\w*|biops\w*|agoaspirat\w*|\bfna\b|pap-?test|\bbal\b|liquor|toracentes\w*|paracentes\w*)\b/i;

const IMAGING_RE =
  /\b(rx|radiograf\w*|\btac\b|\btc\b|tomograf\w*|\brmn?\b|risonanza|pet-?tc|\bpet\b|scintigraf\w*|mammograf\w*|\bmoc\b|dexa|angio-?tc|angio-?rm|uro-?tc|colangio|ecograf\w*|ecocolordoppler|pocus|\bfast\b)\b/i;

const STORED_CATEGORY_ALIASES: Record<string, DiagnosticExamCategory> = {
  imaging: "IMAGING",
  immagini: "IMAGING",
  radiologia: "IMAGING",
  radiodiagnostica: "IMAGING",
  strumentale: "INSTRUMENTAL",
  strumentali: "INSTRUMENTAL",
  endoscopia: "ENDOSCOPY",
  laboratorio: "LAB",
  lab: "LAB",
  img: "IMAGING",
  strum: "INSTRUMENTAL",
  endo: "ENDOSCOPY",
};

function haystack(exam: ChartExamLike): string {
  return `${exam.id} ${exam.name}`.replace(/[_-]+/g, " ");
}

export function normalizeStoredExamCategory(
  raw: string | null | undefined,
): DiagnosticExamCategory | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const upper = trimmed.toUpperCase();
  if ((DIAGNOSTIC_EXAM_CATEGORIES as readonly string[]).includes(upper)) {
    return upper as DiagnosticExamCategory;
  }
  return STORED_CATEGORY_ALIASES[trimmed.toLowerCase()] ?? null;
}

export function classifyExamByName(exam: ChartExamLike): DiagnosticExamCategory | null {
  const text = haystack(exam);
  if (INSTRUMENTAL_RE.test(text)) return "INSTRUMENTAL";
  if (ENDOSCOPY_RE.test(text)) return "ENDOSCOPY";
  if (IMAGING_RE.test(text)) return "IMAGING";
  return null;
}

function categoryFromCatalog<T extends ChartExamLike>(
  examId: string,
  catalog: ChartCatalogMacro<T>[] | null | undefined,
): DiagnosticExamCategory | null {
  if (!catalog) return null;
  for (const macro of catalog) {
    if (macro.groups.some((g) => g.exams.some((e) => e.id === examId))) {
      return MACRO_ID_TO_DIAGNOSTIC_CATEGORY[macro.id] ?? null;
    }
  }
  return null;
}

/**
 * Resolve Imaging vs Strumentale for a single exam.
 * Explicit field → strong name/id heuristic (dirty rows) → catalog macro → OTHER.
 */
export function classifyDiagnosticExam<T extends ChartExamLike>(
  exam: T,
  catalog?: ChartCatalogMacro<T>[] | null,
): DiagnosticExamCategory {
  const explicit =
    exam.diagnosticCategory ??
    normalizeStoredExamCategory(
      typeof (exam as { category?: unknown }).category === "string"
        ? ((exam as { category?: string }).category ?? null)
        : null,
    );
  if (explicit && explicit !== "OTHER") return explicit;

  const heuristic = classifyExamByName(exam);
  if (heuristic) return heuristic;

  return categoryFromCatalog(exam.id, catalog) ?? "OTHER";
}

export function chartSectionForCategory(
  category: DiagnosticExamCategory,
): ChartDiagnosticSection | "lab" | null {
  if (category === "IMAGING") return "imaging";
  if (category === "INSTRUMENTAL" || category === "ENDOSCOPY" || category === "OTHER") {
    return "instrumental";
  }
  if (category === "LAB") return "lab";
  return null;
}

export function examBelongsToChartSection<T extends ChartExamLike>(
  exam: T,
  section: ChartDiagnosticSection,
  catalog?: ChartCatalogMacro<T>[] | null,
): boolean {
  return chartSectionForCategory(classifyDiagnosticExam(exam, catalog)) === section;
}

export function partitionExamsByChartSection<T extends ChartExamLike>(
  exams: T[],
  catalog?: ChartCatalogMacro<T>[] | null,
): { imaging: T[]; instrumental: T[]; lab: T[] } {
  const imaging: T[] = [];
  const instrumental: T[] = [];
  const lab: T[] = [];
  for (const exam of exams) {
    const section = chartSectionForCategory(classifyDiagnosticExam(exam, catalog));
    if (section === "imaging") imaging.push(exam);
    else if (section === "instrumental") instrumental.push(exam);
    else lab.push(exam);
  }
  return { imaging, instrumental, lab };
}

/**
 * Rebuild catalog macros so Imaging / Strumentale tabs never mix radiology with ECG/EEG/etc.
 * Misplaced exams are moved to the canonical macro (`img` | `strum` | `endo`).
 */
export function catalogForChartSection<T extends ChartExamLike>(
  catalog: ChartCatalogMacro<T>[],
  section: ChartDiagnosticSection,
): ChartCatalogMacro<T>[] {
  const templates = new Map(catalog.map((macro) => [macro.id, macro]));
  const buckets = new Map<string, Map<string, { label: string; exams: T[] }>>();

  const ensureGroup = (macroId: string, groupId: string, groupLabel: string) => {
    let groups = buckets.get(macroId);
    if (!groups) {
      groups = new Map();
      buckets.set(macroId, groups);
    }
    let group = groups.get(groupId);
    if (!group) {
      group = { label: groupLabel, exams: [] };
      groups.set(groupId, group);
    }
    return group;
  };

  for (const macro of catalog) {
    if (macro.id === "lab") continue;
    for (const group of macro.groups) {
      for (const exam of group.exams) {
        const category = classifyDiagnosticExam(exam, catalog);
        const targetMacroId =
          category === "OTHER"
            ? "strum"
            : DIAGNOSTIC_CATEGORY_TO_MACRO_ID[
                category as Exclude<DiagnosticExamCategory, "OTHER">
              ];
        if (!targetMacroId || targetMacroId === "lab") continue;

        const targetMacro = templates.get(targetMacroId);
        const keepGroup = targetMacro?.groups.some((g) => g.id === group.id)
          ? group
          : (targetMacro?.groups[0] ?? group);
        ensureGroup(targetMacroId, keepGroup.id, keepGroup.label).exams.push(exam);
      }
    }
  }

  const wantedIds = section === "imaging" ? ["img"] : ["strum", "endo"];
  const result: ChartCatalogMacro<T>[] = [];
  for (const macroId of wantedIds) {
    const template = templates.get(macroId);
    const collected = buckets.get(macroId);
    if (!template || !collected) continue;
    const groups = template.groups
      .map((group) => ({
        ...group,
        exams: collected.get(group.id)?.exams ?? [],
      }))
      .filter((group) => group.exams.length > 0);
    for (const [groupId, extra] of collected) {
      if (template.groups.some((g) => g.id === groupId)) continue;
      if (extra.exams.length === 0) continue;
      groups.push({ id: groupId, label: extra.label, exams: extra.exams });
    }
    if (groups.length === 0) continue;
    result.push({ ...template, groups });
  }
  return result;
}
