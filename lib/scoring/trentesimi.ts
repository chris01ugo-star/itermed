/**
 * SessionReport.totalScore is meant to be 0–30 (trentesimi).
 * Older rows sometimes stored a 0–100 weighted composite — normalize those for display/rankings.
 */
export function normalizeTrentesimiScore(score: number | null | undefined): number | null {
  if (score == null || !Number.isFinite(score)) return null;
  const n = Number(score);
  if (n <= 30) return Math.round(Math.max(0, n) * 10) / 10;
  // Legacy 0–100 composite → trentesimi
  return Math.round(Math.min(100, Math.max(0, n)) * 0.3 * 10) / 10;
}

/** SQL expression fragment (Postgres) that normalizes totalScore to 0–30. */
export const SQL_NORMALIZE_TRENTESIMI = `
  CASE
    WHEN sr."totalScore" IS NULL THEN NULL
    WHEN sr."totalScore" <= 30 THEN sr."totalScore"
    ELSE LEAST(100::float8, GREATEST(0::float8, sr."totalScore")) * 0.3
  END
`.trim();

export const CLINICAL_PASS_TRENTESIMI = 18;
