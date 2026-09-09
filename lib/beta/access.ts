/**
 * Beta-phase access control.
 * Only admins and explicitly authorized plan types may use the product.
 */

import { isPlatformAdminEmail } from "@/lib/auth/platform-admins";

const BETA_PLAN_TYPES = new Set(["BETA", "BETA_TESTER", "EARLY_ACCESS"]);

export function parseBetaEmailAllowlist(raw: string | undefined | null): Set<string> {
  const set = new Set<string>();
  if (!raw?.trim()) return set;
  for (const part of raw.split(",")) {
    const email = part.trim().toLowerCase();
    if (email.includes("@")) set.add(email);
  }
  return set;
}

export function isBetaAuthorized(params: {
  role?: string | null;
  planType?: string | null;
  email?: string | null;
  allowlist?: Set<string>;
}): boolean {
  if (isPlatformAdminEmail(params.email)) return true;

  const role = (params.role ?? "").trim().toUpperCase();
  if (role === "ADMIN") return true;

  const plan = (params.planType ?? "").trim().toUpperCase();
  if (BETA_PLAN_TYPES.has(plan)) return true;

  const email = (params.email ?? "").trim().toLowerCase();
  if (email && params.allowlist?.has(email)) return true;

  return false;
}

export function getBetaEmailAllowlistFromEnv(): Set<string> {
  return parseBetaEmailAllowlist(process.env.BETA_EMAIL_ALLOWLIST);
}
