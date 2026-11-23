import { config } from "@/lib/config";
import { toSaasPlanId, type SaasPlanId } from "@/lib/billing/plans";

export function startPriceId(): string | undefined {
  return config.STRIPE_PRICE_START || config.STRIPE_PRICE_STUDENT;
}

export function plusPriceId(): string | undefined {
  return config.STRIPE_PRICE_PLUS || config.STRIPE_PRICE_PREMIUM;
}

export function extraCreditsPriceId(): string | undefined {
  return config.STRIPE_PRICE_EXTRA_CREDITS;
}

export function priceIdForPlan(plan: SaasPlanId): string | undefined {
  return plan === "PLUS" ? plusPriceId() : startPriceId();
}

export function planFromPriceId(priceId: string | undefined | null): SaasPlanId | null {
  if (!priceId) return null;
  if (priceId === plusPriceId() || priceId === config.STRIPE_PRICE_PREMIUM) return "PLUS";
  if (priceId === startPriceId() || priceId === config.STRIPE_PRICE_STUDENT) return "START";
  return null;
}

export function checkoutPlanFromInput(raw: string): SaasPlanId | null {
  return toSaasPlanId(raw);
}
