/** Commercial plan identifiers stored on User.planType. */
export type PlanType = "FREE" | "STUDENT" | "PREMIUM";

/** Soft daily cap while payments are not live. Resets at midnight Europe/Rome. */
export const DAILY_SIMULATION_LIMIT = 3;
/** @deprecated Use DAILY_SIMULATION_LIMIT — kept for older call sites. */
export const FREE_TRIAL_SIMULATION_LIMIT = DAILY_SIMULATION_LIMIT;
export const FREE_CHAT_MESSAGE_LIMIT = 5;
export const PAID_CHAT_MESSAGE_LIMIT = 15;

export const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing"]);

export function isSubscriptionPlan(planType: string | null | undefined): planType is "STUDENT" | "PREMIUM" {
  return planType === "STUDENT" || planType === "PREMIUM";
}
