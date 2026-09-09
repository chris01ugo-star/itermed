/**
 * Privileged clinical-case access: ADMIN role, dedicated audit account,
 * and sponsored free-case grants (lifetime cap, not admin).
 * Regular students / instructors keep daily quotas and bundle paywalls.
 */

export const AUDIT_UNLIMITED_CASE_EMAIL = "chris01.ugo@gmail.com";

/** Sponsored learner: 20 clinical simulations, no daily cap / paywall until exhausted. */
export const SPONSORED_FREE_CASE_EMAIL = "robquellodelfonendo@gmail.com";
export const SPONSORED_FREE_CASE_LIMIT = 20;

export function normalizeAccountEmail(email: string | null | undefined): string {
  return (email ?? "").toLowerCase().trim();
}

export function hasUnlimitedCaseAccess(user: {
  role?: string | null;
  email?: string | null;
} | null | undefined): boolean {
  if (!user) return false;
  if (user.role === "ADMIN") return true;
  return normalizeAccountEmail(user.email) === AUDIT_UNLIMITED_CASE_EMAIL;
}

export function isSponsoredFreeCaseEmail(email: string | null | undefined): boolean {
  return normalizeAccountEmail(email) === SPONSORED_FREE_CASE_EMAIL;
}

/** Lifetime CaseSession cap for a sponsored email; `null` if not on the grant list. */
export function getSponsoredFreeCaseLimit(email: string | null | undefined): number | null {
  return isSponsoredFreeCaseEmail(email) ? SPONSORED_FREE_CASE_LIMIT : null;
}

/** True while the sponsored 20-case bundle still has remaining starts. */
export function hasActiveSponsoredCaseGrant(
  user: { email?: string | null } | null | undefined,
  lifetimeUsed: number,
): boolean {
  const limit = getSponsoredFreeCaseLimit(user?.email);
  if (limit == null) return false;
  const used = Number.isFinite(lifetimeUsed) ? Math.max(0, Math.floor(lifetimeUsed)) : 0;
  return used < limit;
}
