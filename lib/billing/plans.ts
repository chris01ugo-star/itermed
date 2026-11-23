/** Commercial plan identifiers stored on User.planType. */
export type PlanType = "FREE" | "STUDENT" | "PREMIUM" | "START" | "PLUS";

/** Soft daily cap while payments are not live. Resets at midnight Europe/Rome. */
export const DAILY_SIMULATION_LIMIT = 3;
/** @deprecated Use DAILY_SIMULATION_LIMIT — kept for older call sites. */
export const FREE_TRIAL_SIMULATION_LIMIT = DAILY_SIMULATION_LIMIT;
export const FREE_CHAT_MESSAGE_LIMIT = 5;
export const PAID_CHAT_MESSAGE_LIMIT = 15;

export const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing"]);

/** Paid SaaS plans shown in the UI. STUDENT/PREMIUM are legacy stored aliases. */
export type SaasPlanId = "START" | "PLUS";

export type SaasPlanDefinition = {
  id: SaasPlanId;
  /** Value persisted on User.planType (keeps existing Stripe STUDENT/PREMIUM rows). */
  storedPlanType: "STUDENT" | "PREMIUM";
  displayName: string;
  monthlyPriceCents: number;
  monthlyPriceLabel: string;
  monthlyCredits: number;
  monthlyCap: number;
};

export const SAAS_PLANS: Record<SaasPlanId, SaasPlanDefinition> = {
  START: {
    id: "START",
    storedPlanType: "STUDENT",
    displayName: "Aequan Start",
    monthlyPriceCents: 990,
    monthlyPriceLabel: "9,90 €/mese",
    monthlyCredits: 12,
    monthlyCap: 24,
  },
  PLUS: {
    id: "PLUS",
    storedPlanType: "PREMIUM",
    displayName: "Aequan Plus",
    monthlyPriceCents: 1690,
    monthlyPriceLabel: "16,90 €/mese",
    monthlyCredits: 30,
    monthlyCap: 60,
  },
};

export const EXTRA_CREDIT_PACK = {
  id: "extra_credits_5",
  credits: 5,
  priceCents: 490,
  priceLabel: "4,90 €",
  displayName: "5 simulazioni extra",
} as const;

export const REFERRAL_INVITER_BONUS = 10;
export const REFERRAL_INVITEE_BONUS = 5;

export function toSaasPlanId(planType: string | null | undefined): SaasPlanId | null {
  const p = (planType ?? "").trim().toUpperCase();
  if (p === "START" || p === "STUDENT") return "START";
  if (p === "PLUS" || p === "PREMIUM") return "PLUS";
  return null;
}

export function toStoredPlanType(plan: SaasPlanId): "STUDENT" | "PREMIUM" {
  return SAAS_PLANS[plan].storedPlanType;
}

export function saasPlanDefinition(planType: string | null | undefined): SaasPlanDefinition | null {
  const id = toSaasPlanId(planType);
  return id ? SAAS_PLANS[id] : null;
}

export function isSubscriptionPlan(
  planType: string | null | undefined,
): planType is "STUDENT" | "PREMIUM" | "START" | "PLUS" {
  return toSaasPlanId(planType) != null;
}

/** Monthly credits granted after a paid period, clamped so the monthly bucket never exceeds the plan cap. */
export function applyMonthlyGrant(
  currentMonthly: number,
  grant: number,
  cap: number,
): { nextMonthly: number; granted: number } {
  const safeCurrent = Math.max(0, Math.floor(currentMonthly));
  const safeGrant = Math.max(0, Math.floor(grant));
  const safeCap = Math.max(0, Math.floor(cap));
  const granted = Math.min(safeGrant, Math.max(0, safeCap - safeCurrent));
  return { nextMonthly: safeCurrent + granted, granted };
}

export function clampMonthlyToCap(currentMonthly: number, cap: number): number {
  return Math.min(Math.max(0, Math.floor(currentMonthly)), Math.max(0, Math.floor(cap)));
}

export type CreditBucketName = "MONTHLY" | "PURCHASED" | "REFERRAL";

/** Consume order: monthly plan credits, then purchased extras, then referral bonus. */
export function pickConsumeBucket(balances: {
  monthlyBalance: number;
  purchasedBalance: number;
  referralBalance: number;
}): CreditBucketName | null {
  if (balances.monthlyBalance > 0) return "MONTHLY";
  if (balances.purchasedBalance > 0) return "PURCHASED";
  if (balances.referralBalance > 0) return "REFERRAL";
  return null;
}

export function totalAvailableCredits(balances: {
  monthlyBalance: number;
  purchasedBalance: number;
  referralBalance: number;
}): number {
  return (
    Math.max(0, balances.monthlyBalance) +
    Math.max(0, balances.purchasedBalance) +
    Math.max(0, balances.referralBalance)
  );
}
