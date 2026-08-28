/**
 * Cascading SSN tariff resolution for Gold Path / omission pricing.
 * Exact ID → authored case price → token/component match → category median → default.
 */

import { flattenCatalogExams } from "@/lib/exam-catalog-structure";
import { EXAM_DEFAULT_VALUES, type ExamClinicalMeta } from "@/lib/exam-default-values";

/** Floor tariff when no nomenclatore match exists (prestazione ambulatoriale generica). */
export const DEFAULT_SSN_TARIFF_EURO = 25;

const CATALOG_ROWS = flattenCatalogExams();
const CATEGORY_BY_ID = new Map(CATALOG_ROWS.map((r) => [r.id, r.category] as const));

function safePositiveEuro(n: unknown): number | null {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v) || v <= 0) return null;
  return v;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!;
}

function tokenizeExamKey(examId: string): string[] {
  return examId
    .toLowerCase()
    .split(/[\s/_+,.-]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3);
}

function priceFromCatalogId(
  examId: string,
  catalog: Record<string, ExamClinicalMeta>,
): number | null {
  return (
    safePositiveEuro(catalog[examId]?.price) ??
    safePositiveEuro(EXAM_DEFAULT_VALUES[examId]?.price)
  );
}

/** Median nomenclatore price for exams in the same catalog macro-category. */
function categoryFallbackPrice(
  examId: string,
  catalog: Record<string, ExamClinicalMeta>,
): number | null {
  const category = CATEGORY_BY_ID.get(examId);
  const siblingIds = category
    ? CATALOG_ROWS.filter((r) => r.category === category).map((r) => r.id)
    : [];

  // Composite / unknown id: infer category from longest matching catalog token.
  let ids = siblingIds;
  if (ids.length === 0) {
    const tokens = tokenizeExamKey(examId);
    let bestCategory: string | null = null;
    let bestLen = 0;
    for (const row of CATALOG_ROWS) {
      if (tokens.some((t) => row.id.includes(t) || t.includes(row.id))) {
        if (row.id.length >= bestLen) {
          bestLen = row.id.length;
          bestCategory = row.category;
        }
      }
    }
    if (bestCategory) {
      ids = CATALOG_ROWS.filter((r) => r.category === bestCategory).map((r) => r.id);
    }
  }

  const prices: number[] = [];
  for (const id of ids) {
    const p = priceFromCatalogId(id, catalog);
    if (p != null) prices.push(p);
  }
  return median(prices);
}

/** Sum of matching atomic catalog component prices for composite exam ids. */
function componentTokenPrice(
  examId: string,
  catalog: Record<string, ExamClinicalMeta>,
): number | null {
  const tokens = tokenizeExamKey(examId);
  if (tokens.length === 0) return null;

  const matched = new Set<string>();
  let sum = 0;
  for (const [id, meta] of Object.entries({ ...EXAM_DEFAULT_VALUES, ...catalog })) {
    const price = safePositiveEuro(meta.price);
    if (price == null) continue;
    const idNorm = id.toLowerCase();
    const hit = tokens.some(
      (t) => idNorm === t || idNorm.includes(t) || t.includes(idNorm),
    );
    if (!hit || matched.has(id)) continue;
    matched.add(id);
    sum += price;
  }
  return sum > 0 ? Number(sum.toFixed(2)) : null;
}

export type ResolveSsnTariffParams = {
  examId: string;
  /** Runtime / DB catalog (overrides defaults). */
  catalog?: Record<string, ExamClinicalMeta> | null;
  /** Authored case price (mandatoryExams.priceEuro). */
  authoredPriceEuro?: number | null;
  /** Explicit caller fallback (e.g. ordered exam cost). */
  fallbackCost?: number | null;
};

/**
 * Cascade: authored → exact catalog ID → component tokens → category median → default SSN.
 * Always returns a finite euro amount > 0.
 */
export function resolveSsnTariffEuro(params: ResolveSsnTariffParams): number {
  const catalog = params.catalog ?? {};
  const examId = (params.examId || "").trim();

  const authored = safePositiveEuro(params.authoredPriceEuro);
  if (authored != null) return authored;

  if (examId) {
    const exact = priceFromCatalogId(examId, catalog);
    if (exact != null) return exact;

    const components = componentTokenPrice(examId, catalog);
    if (components != null) return components;

    const category = categoryFallbackPrice(examId, catalog);
    if (category != null) return Number(category.toFixed(2));
  }

  const fallback = safePositiveEuro(params.fallbackCost);
  if (fallback != null) return fallback;

  return DEFAULT_SSN_TARIFF_EURO;
}
