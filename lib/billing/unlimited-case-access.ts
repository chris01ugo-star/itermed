/**
 * Privileged clinical-case access: ADMIN role, or the dedicated audit account.
 * Regular students / instructors keep daily quotas and bundle paywalls.
 */

export const AUDIT_UNLIMITED_CASE_EMAIL = "chris01.ugo@gmail.com";

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
