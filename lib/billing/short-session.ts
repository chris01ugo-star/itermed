/** Wall-clock threshold: shorter sessions are not counted as used. */
export const MIN_BILLABLE_SESSION_MS = 30_000;

export function isSessionTooShort(
  createdAt: Date,
  now: Date = new Date(),
  thresholdMs: number = MIN_BILLABLE_SESSION_MS,
): boolean {
  return now.getTime() - createdAt.getTime() < thresholdMs;
}
