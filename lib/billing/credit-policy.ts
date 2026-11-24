import { ACTIVE_SUBSCRIPTION_STATUSES, isSubscriptionPlan } from "@/lib/billing/plans";
import { hasUnlimitedCaseAccess } from "@/lib/billing/unlimited-case-access";
import { isBetaAuthorized, getBetaEmailAllowlistFromEnv } from "@/lib/beta/access";
import { resolveSimulationEntitlement } from "@/lib/billing/simulation-entitlement";

type CreditPolicyUser = {
  role?: string | null;
  email?: string | null;
  planType?: string | null;
  subscriptionStatus?: string | null;
  isActive?: boolean | null;
  freeSimulationLimit?: number | null;
};

export const CREDITS_EXHAUSTED_CODE = "CREDITS_EXHAUSTED";
export const CREDITS_EXHAUSTED_MESSAGE =
  "Hai esaurito i crediti di simulazione. Acquista un pacchetto extra o passa ad Aequan Plus.";

export const SUBSCRIPTION_REQUIRED_CODE = "SUBSCRIPTION_REQUIRED";
export const SUBSCRIPTION_REQUIRED_MESSAGE =
  "Per avviare una nuova simulazione serve un abbonamento Aequan attivo. I report e lo storico restano consultabili.";

/** True Stripe Start/Plus — admins are not treated as paying subscribers. */
export function hasPaidSaasSubscription(profile: CreditPolicyUser): boolean {
  if (!isSubscriptionPlan(profile.planType)) return false;
  if (!profile.subscriptionStatus) return false;
  return ACTIVE_SUBSCRIPTION_STATUSES.has(profile.subscriptionStatus);
}

/** Live simulator: paid Start/Plus, or admin / unlimited grant. Unpaid BETA/INVITED stay locked. */
export function mayStartLiveSimulation(profile: CreditPolicyUser): boolean {
  const entitlement = resolveSimulationEntitlement(profile);
  if (!entitlement.isActive) return false;
  if (entitlement.unlimited) return true;
  return hasPaidSaasSubscription(profile);
}

function hasPaidSubscription(profile: CreditPolicyUser): boolean {
  return hasPaidSaasSubscription(profile);
}

/**
 * Paid Start/Plus subscribers spend ledger credits.
 * Admins, INVITED/BETA testers, and other existing entitlements skip the ledger
 * until they actually subscribe.
 */
export function shouldConsumeCredits(profile: CreditPolicyUser): boolean {
  if (hasUnlimitedCaseAccess(profile)) return false;
  return hasPaidSubscription(profile);
}

export function canStartWithoutPaidCredits(profile: CreditPolicyUser): boolean {
  if (hasUnlimitedCaseAccess(profile)) return true;
  const plan = (profile.planType ?? "").trim().toUpperCase();
  if (plan === "BETA" || plan === "BETA_TESTER" || plan === "EARLY_ACCESS") return true;
  return isBetaAuthorized({
    role: profile.role,
    planType: profile.planType,
    email: profile.email,
    allowlist: getBetaEmailAllowlistFromEnv(),
  });
}
