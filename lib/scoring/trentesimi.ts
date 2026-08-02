/**
 * SessionReport.totalScore is meant to be 0–30 (trentesimi).
 * Older rows sometimes stored a 0–100 weighted composite — normalize those for display/rankings.
 *
 * Partial dimension scores (clinicalAccuracy, legalComplianceGelliBianco,
 * prescribingAppropriateness, empathy) remain on a 0–100 scale in the DB.
 * economicSustainability is also 0–100 but is an analytical radar metric — it does
 * NOT feed `computeTotalScoreTrentesimi` (the 20% exam weight uses prescribingAppropriateness).
 */

/** Passing threshold on the trentesimi scale (Killer-Switch caps below this). */
export const CLINICAL_PASS_TRENTESIMI = 18;

/** Clamp a 0–100 percentage score; never NaN. */
export function clampPercentScore(score: number | null | undefined): number {
  if (score == null || !Number.isFinite(Number(score))) return 0;
  return Math.max(0, Math.min(100, Number(score)));
}

/**
 * Normalize any stored total to the 0–30 display scale.
 * - Values ≤ 30 are treated as already-trentesimi.
 * - Values > 30 are treated as legacy 0–100 composites (× 0.3).
 * Always returns a finite number in [0, 30], or null if input is nullish/non-finite.
 */
export function normalizeTrentesimiScore(score: number | null | undefined): number | null {
  if (score == null || !Number.isFinite(Number(score))) return null;
  const n = Number(score);
  if (n <= 30) return Math.round(Math.max(0, Math.min(30, n)) * 10) / 10;
  // Legacy 0–100 composite → trentesimi
  return Math.round(Math.min(100, Math.max(0, n)) * 0.3 * 10) / 10;
}

/** Display helper — never throws / never NaN; defaults to 0. */
export function safeDisplayTrentesimi(score: number | null | undefined): number {
  return normalizeTrentesimiScore(score) ?? 0;
}

/** SQL expression fragment (Postgres) that normalizes totalScore to 0–30. */
export const SQL_NORMALIZE_TRENTESIMI = `
  CASE
    WHEN sr."totalScore" IS NULL THEN NULL
    WHEN sr."totalScore" <= 30 THEN LEAST(30::float8, GREATEST(0::float8, sr."totalScore"))
    ELSE LEAST(100::float8, GREATEST(0::float8, sr."totalScore")) * 0.3
  END
`.trim();
