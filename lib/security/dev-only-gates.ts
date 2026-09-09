/**
 * Dev-only privilege gates.
 *
 * Client flags (`devBypass`, `bypassDailyLimit`) and mock-admin auth are
 * syntactically reachable in the bundle, but they are logically inert unless
 * `process.env.NODE_ENV === "development"` (i.e. `next dev`). Staging, preview,
 * production, and CI (`test`) all fail this check.
 */

export function isRuntimeDevelopment(): boolean {
  return process.env.NODE_ENV === "development";
}

/** True only when a client-supplied quota bypass may be honored. */
export function isClientDevBypassHonored(): boolean {
  return isRuntimeDevelopment();
}

/**
 * Defense in depth for `bypassDailyLimit` / `devBypass`.
 * Returns true only when the caller set the flag AND we are on `next dev`.
 */
export function canHonorDailyLimitBypass(flag: boolean | undefined): boolean {
  return flag === true && isClientDevBypassHonored();
}

/**
 * Reject an explicit `devBypass: true` outside development with 403.
 * Omitted / false values are ignored (not an error).
 */
export function rejectNonDevelopmentDevBypass(devBypass: unknown): Response | null {
  if (devBypass !== true) return null;
  if (isClientDevBypassHonored()) return null;

  return new Response(
    JSON.stringify({
      error: "Forbidden",
      code: "DEV_BYPASS_FORBIDDEN",
    }),
    {
      status: 403,
      headers: { "Content-Type": "application/json" },
    },
  );
}
