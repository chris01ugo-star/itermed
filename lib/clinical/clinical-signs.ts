import { z } from "zod";

/** Semeiotica: segno clinico / manovra con reperto atteso dal caso. */
export type ClinicalSign = {
  signName: string;
  result: string;
  isPositive: boolean;
};

export const CLINICAL_SIGN_EXAM_PREFIX = "semeiotic:";

export const NEGATIVE_SEMEIOTIC_FINDING =
  "Nessuna reazione particolare; il paziente non riferisce dolore specifico per questa manovra.";

export const ClinicalSignSchema = z.object({
  signName: z.string().min(2).max(160),
  result: z.string().min(1).max(800),
  isPositive: z.boolean(),
});

const ClinicalSignRecordValueSchema = z.union([
  z.string().min(1).max(800),
  z
    .object({
      signName: z.string().min(2).max(160).optional(),
      name: z.string().min(2).max(160).optional(),
      result: z.string().min(1).max(800).optional(),
      finding: z.string().min(1).max(800).optional(),
      isPositive: z.boolean().optional(),
      positive: z.boolean().optional(),
    })
    .passthrough(),
]);

/** Array canonico oppure dizionario chiave → reperto (legacy / import). */
export const ClinicalSignsFieldSchema = z
  .union([z.array(ClinicalSignSchema), z.record(z.string().min(1), ClinicalSignRecordValueSchema)])
  .optional();

function asText(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

function asBool(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const s = value.trim().toLowerCase();
    if (["true", "positivo", "positive", "1", "si", "sì"].includes(s)) return true;
    if (["false", "negativo", "negative", "0", "no"].includes(s)) return false;
  }
  return null;
}

export function slugClinicalSign(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\bsegno\s+di\s+/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function clinicalSignExamId(sign: ClinicalSign): string {
  return `${CLINICAL_SIGN_EXAM_PREFIX}${slugClinicalSign(sign.signName)}`;
}

export function isClinicalSignExamId(examId: string | null | undefined): boolean {
  if (!examId) return false;
  return /^(semeiotic|clinical-sign|semeiotics):/i.test(examId.trim());
}

function coerceSign(raw: unknown, fallbackName: string): ClinicalSign | null {
  if (raw == null) return null;
  if (typeof raw === "string") {
    const result = raw.trim();
    const name = fallbackName.trim();
    if (!result || !name) return null;
    const positive = !/negativ/i.test(result);
    return { signName: name, result, isPositive: positive };
  }
  if (typeof raw !== "object" || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  const signName =
    asText(row.signName) || asText(row.name) || asText(row.sign) || fallbackName.trim();
  const result = asText(row.result) || asText(row.finding) || asText(row.description);
  if (!signName || !result) return null;
  const positive =
    asBool(row.isPositive) ??
    asBool(row.positive) ??
    asBool(row.isAbnormal) ??
    !/negativ/i.test(result);
  return { signName, result, isPositive: Boolean(positive) };
}

function readSignsField(raw: unknown): ClinicalSign[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw
      .map((row, i) => coerceSign(row, typeof row === "object" && row && "signName" in row ? "" : `Segno ${i + 1}`))
      .filter((row): row is ClinicalSign => Boolean(row));
  }
  if (typeof raw !== "object") return [];
  const out: ClinicalSign[] = [];
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const sign = coerceSign(value, key);
    if (sign) out.push(sign);
  }
  return out;
}

/** Parse `baselineExamFindings.clinicalSigns` (alias `semeiotics`). Never invents signs. */
export function parseClinicalSigns(
  baseline: Record<string, unknown> | null | undefined,
): ClinicalSign[] {
  if (!baseline || typeof baseline !== "object") return [];
  const primary = readSignsField(baseline.clinicalSigns);
  if (primary.length > 0) return primary;
  return readSignsField(baseline.semeiotics);
}

export function serializeClinicalSignsJson(
  baseline: Record<string, unknown> | null | undefined,
): string {
  return JSON.stringify(parseClinicalSigns(baseline));
}

export function matchClinicalSign(
  signs: ClinicalSign[],
  query: { id?: string | null; label?: string | null },
): ClinicalSign | null {
  if (signs.length === 0) return null;
  const rawId = (query.id ?? "").trim();
  const rawLabel = (query.label ?? "").trim();
  const idSlug = slugClinicalSign(rawId.replace(/^(semeiotic|clinical-sign|semeiotics):/i, ""));
  const labelSlug = slugClinicalSign(rawLabel);

  for (const sign of signs) {
    const signSlug = slugClinicalSign(sign.signName);
    if (!signSlug) continue;
    if (rawId && rawId === clinicalSignExamId(sign)) return sign;
    if (idSlug && idSlug === signSlug) return sign;
    if (labelSlug && labelSlug === signSlug) return sign;
    if (labelSlug.length >= 4 && (labelSlug.includes(signSlug) || signSlug.includes(labelSlug))) {
      return sign;
    }
  }
  return null;
}

export function formatClinicalSignFinding(sign: ClinicalSign): string {
  const text = sign.result.trim();
  if (text) return text;
  return sign.isPositive
    ? `Reazione presente alla manovra (${sign.signName}).`
    : NEGATIVE_SEMEIOTIC_FINDING;
}
