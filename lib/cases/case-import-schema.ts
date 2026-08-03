import { z } from "zod";
import { GoldStandardPathSchema } from "@/lib/cases/case-creator-schemas";
import { parseGoldStandardPath } from "@/lib/cases/simulation-time";

/**
 * Canonical vitals required for playable beta cases.
 * Aliases (hr, bp, …) are normalized before validation.
 */
const CanonicalVitalsSchema = z.object({
  heartRate: z.union([z.number(), z.string()]).refine(
    (v) => {
      const n = typeof v === "number" ? v : Number(String(v).replace(/[^\d.]/g, ""));
      return Number.isFinite(n) && n > 0;
    },
    { message: "heartRate obbligatorio e numerico" },
  ),
  bloodPressure: z.string().min(3, "bloodPressure obbligatorio (es. 120/80)"),
  spo2: z.union([z.number(), z.string()]).refine(
    (v) => {
      const n = typeof v === "number" ? v : Number(String(v).replace(/[^\d.]/g, ""));
      return Number.isFinite(n) && n > 0 && n <= 100;
    },
    { message: "spo2 obbligatorio (1–100)" },
  ),
  temperature: z.union([z.number(), z.string()]).refine(
    (v) => {
      const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
      return Number.isFinite(n) && n > 30 && n < 45;
    },
    { message: "temperature obbligatoria (°C)" },
  ),
  respiratoryRate: z.union([z.number(), z.string()]).refine(
    (v) => {
      const n = typeof v === "number" ? v : Number(String(v).replace(/[^\d.]/g, ""));
      return Number.isFinite(n) && n > 0;
    },
    { message: "respiratoryRate obbligatoria" },
  ),
});

const ExamFindingValueSchema = z
  .object({
    normalFinding: z.string().min(1).optional(),
    finding: z.string().min(1).optional(),
    value: z.union([z.string(), z.number()]).optional().nullable(),
    isAbnormal: z.boolean().optional(),
    price: z.number().optional(),
    customCost: z.number().optional(),
  })
  .refine(
    (row) =>
      Boolean(
        (row.normalFinding && row.normalFinding.trim()) ||
          (row.finding && row.finding.trim()) ||
          row.value != null,
      ),
    { message: "Ogni override esame richiede finding/normalFinding/value" },
  );

/**
 * Beta ingest gate: refuse playable publish when gold / vitals / exam findings are incomplete.
 */
export const CaseImportBaselineSchema = z.object({
  vitals: CanonicalVitalsSchema,
  examBudgetEuro: z.number().positive().optional(),
  advancedExams: z
    .object({
      values: z.record(z.string().min(1), ExamFindingValueSchema).optional(),
    })
    .optional(),
});

export const CaseImportSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().min(10).max(8000),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]).default("MEDIUM"),
  goldStandardPath: GoldStandardPathSchema,
  baselineExamFindings: CaseImportBaselineSchema,
  correctSolution: z.string().min(2).max(4000).optional().nullable(),
  patientPrompt: z.string().min(20).max(8000).optional().nullable(),
});

export type CaseImportInput = z.infer<typeof CaseImportSchema>;

const VITAL_ALIASES: Record<string, keyof z.infer<typeof CanonicalVitalsSchema>> = {
  hr: "heartRate",
  heart_rate: "heartRate",
  heartrate: "heartRate",
  bp: "bloodPressure",
  blood_pressure: "bloodPressure",
  sao2: "spo2",
  sp_o2: "spo2",
  temp: "temperature",
  rr: "respiratoryRate",
  respiratory_rate: "respiratoryRate",
};

/** Normalize alias keys (hr→heartRate) and lift top-level `{finding}` into advancedExams.values. */
export function normalizeCaseBaselineForImport(
  raw: unknown,
): Record<string, unknown> {
  const baseline =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? { ...(raw as Record<string, unknown>) }
      : {};

  const vitalsRaw =
    baseline.vitals && typeof baseline.vitals === "object" && !Array.isArray(baseline.vitals)
      ? { ...(baseline.vitals as Record<string, unknown>) }
      : {};

  for (const [alias, canonical] of Object.entries(VITAL_ALIASES)) {
    if (vitalsRaw[canonical] == null && vitalsRaw[alias] != null) {
      vitalsRaw[canonical] = vitalsRaw[alias];
    }
  }
  baseline.vitals = vitalsRaw;

  const advanced =
    baseline.advancedExams &&
    typeof baseline.advancedExams === "object" &&
    !Array.isArray(baseline.advancedExams)
      ? { ...(baseline.advancedExams as Record<string, unknown>) }
      : {};
  const values =
    advanced.values && typeof advanced.values === "object" && !Array.isArray(advanced.values)
      ? { ...(advanced.values as Record<string, unknown>) }
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

  for (const [key, value] of Object.entries(baseline)) {
    if (reserved.has(key)) continue;
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const row = value as Record<string, unknown>;
    const finding =
      typeof row.finding === "string"
        ? row.finding
        : typeof row.normalFinding === "string"
          ? row.normalFinding
          : null;
    if (!finding?.trim()) continue;
    if (values[key]) continue;
    values[key] = {
      normalFinding: finding.trim(),
      isAbnormal: row.isAbnormal === true,
      ...(typeof row.price === "number" ? { price: row.price } : {}),
      ...(typeof row.customCost === "number" ? { customCost: row.customCost } : {}),
    };
  }

  if (Object.keys(values).length > 0) {
    baseline.advancedExams = { ...advanced, values };
  }

  return baseline;
}

export type CaseImportIssue = { path: string; message: string };

/**
 * Validates a case payload for beta ingest. Returns issues (empty = playable).
 * Never throws — callers gate publish / seed on `ok`.
 */
export function assertPlayableCase(input: {
  title?: unknown;
  description?: unknown;
  difficulty?: unknown;
  goldStandardPath?: unknown;
  baselineExamFindings?: unknown;
  correctSolution?: unknown;
  patientPrompt?: unknown;
}): { ok: boolean; issues: CaseImportIssue[]; normalizedBaseline: Record<string, unknown> } {
  const issues: CaseImportIssue[] = [];
  const gold = parseGoldStandardPath(input.goldStandardPath);
  if (gold.length === 0) {
    issues.push({
      path: "goldStandardPath",
      message: "goldStandardPath vuoto o assente — il caso non è pubblicabile in Beta",
    });
  }

  const normalizedBaseline = normalizeCaseBaselineForImport(input.baselineExamFindings);
  const parsed = CaseImportSchema.safeParse({
    title: input.title ?? "Untitled",
    description: input.description ?? "Descrizione caso clinico mancante.",
    difficulty: input.difficulty ?? "MEDIUM",
    goldStandardPath: gold.length > 0 ? gold : ["__missing__"],
    baselineExamFindings: normalizedBaseline,
    correctSolution: input.correctSolution,
    patientPrompt: input.patientPrompt,
  });

  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      // Skip synthetic gold placeholder errors when we already reported empty gold.
      if (
        gold.length === 0 &&
        issue.path[0] === "goldStandardPath"
      ) {
        continue;
      }
      issues.push({
        path: issue.path.join(".") || "(root)",
        message: issue.message,
      });
    }
  }

  const values =
    normalizedBaseline.advancedExams &&
    typeof normalizedBaseline.advancedExams === "object" &&
    !Array.isArray(normalizedBaseline.advancedExams)
      ? (normalizedBaseline.advancedExams as { values?: Record<string, unknown> }).values
      : undefined;
  if (!values || Object.keys(values).length === 0) {
    issues.push({
      path: "baselineExamFindings.advancedExams.values",
      message:
        "Nessun reperto esame (advancedExams.values o finding top-level) — i laboratori resterebbero ai default normali",
    });
  }

  return { ok: issues.length === 0, issues, normalizedBaseline };
}
