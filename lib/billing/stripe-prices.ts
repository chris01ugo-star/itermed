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

/** Env may hold a Price ID (`price_`) or a Product ID (`prod_`). */
export function catalogRefMatches(
  envValue: string | undefined | null,
  priceId?: string | null,
  productId?: string | null,
): boolean {
  const env = envValue?.trim();
  if (!env) return false;
  return env === priceId?.trim() || env === productId?.trim();
}

export function planFromPriceId(
  priceId: string | undefined | null,
  productId?: string | null,
): SaasPlanId | null {
  if (
    catalogRefMatches(plusPriceId(), priceId, productId) ||
    catalogRefMatches(config.STRIPE_PRICE_PREMIUM, priceId, productId)
  ) {
    return "PLUS";
  }
  if (
    catalogRefMatches(startPriceId(), priceId, productId) ||
    catalogRefMatches(config.STRIPE_PRICE_STUDENT, priceId, productId)
  ) {
    return "START";
  }
  return null;
}

export function stripeProductIdOf(price: { product?: unknown } | null | undefined): string | null {
  const product = price?.product;
  if (typeof product === "string") return product;
  if (product && typeof product === "object" && "id" in product) {
    const id = (product as { id?: unknown }).id;
    return typeof id === "string" ? id : null;
  }
  return null;
}

export function checkoutPlanFromInput(raw: string): SaasPlanId | null {
  return toSaasPlanId(raw);
}
