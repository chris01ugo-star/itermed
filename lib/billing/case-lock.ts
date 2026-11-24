/**
 * Client-safe lock rules for Prassi folders.
 * Server routes still enforce the same paywall in `assertCanStartSimulation`.
 */

export function isCaseLockedForLearner(opts: {
  requiresPaidPlan?: boolean;
  adminBypass?: boolean;
}): boolean {
  return Boolean(opts.requiresPaidPlan) && !opts.adminBypass;
}

/** Completed reports stay readable; live play does not. */
export function lockedCaseMayOpenBriefing(opts: {
  requiresPaidPlan?: boolean;
  adminBypass?: boolean;
  playStatus?: string | null;
  lastReportId?: string | null;
}): boolean {
  if (!isCaseLockedForLearner(opts)) return true;
  return opts.playStatus === "completed" && Boolean(opts.lastReportId);
}
