/**
 * Beta-phase access control.
 * Closed university pilot: platform admins + PILOT_ALLOWED_EMAILS
 * + sponsored 20-case grant emails + optional env extras.
 */

import { isPlatformAdminEmail } from "@/lib/auth/platform-admins";
import { isSponsoredFreeCaseEmail } from "@/lib/billing/unlimited-case-access";
import { isPilotAllowedEmail, normalizePilotEmail } from "@/lib/pilot-whitelist";

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

  if (isPilotAllowedEmail(params.email)) return true;
  if (isSponsoredFreeCaseEmail(params.email)) return true;

  const email = normalizePilotEmail(params.email);
  if (email && params.allowlist?.has(email)) return true;

  return false;
}

export function getBetaEmailAllowlistFromEnv(): Set<string> {
  return parseBetaEmailAllowlist(process.env.BETA_EMAIL_ALLOWLIST);
}
