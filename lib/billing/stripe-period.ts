import type Stripe from "stripe";

type PeriodHolder = {
  current_period_start?: number | null;
  current_period_end?: number | null;
  cancel_at_period_end?: boolean;
};

export function subscriptionPeriod(subscription: Stripe.Subscription): {
  start: Date | null;
  end: Date | null;
  cancelAtPeriodEnd: boolean;
} {
  const root = subscription as unknown as PeriodHolder;
  const item = (subscription.items?.data?.[0] ?? null) as PeriodHolder | null;
  const startUnix = root.current_period_start ?? item?.current_period_start ?? null;
  const endUnix = root.current_period_end ?? item?.current_period_end ?? null;
  return {
    start: startUnix ? new Date(startUnix * 1000) : null,
    end: endUnix ? new Date(endUnix * 1000) : null,
    cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
  };
}

export function invoicePeriodStart(invoice: Stripe.Invoice): Date {
  if (invoice.period_start) return new Date(invoice.period_start * 1000);
  return new Date();
}

export function stripeCustomerId(
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null | undefined,
): string | null {
  if (!customer) return null;
  if (typeof customer === "string") return customer;
  return customer.id ?? null;
}

export function paymentFingerprintFromCharge(charge: Stripe.Charge | null | undefined): string | null {
  if (!charge) return null;
  const card = charge.payment_method_details?.card;
  const fingerprint = card && "fingerprint" in card ? card.fingerprint : null;
  return fingerprint?.trim() || null;
}
