import "server-only";
import type Stripe from "stripe";

/** Shared hosted-Checkout settings for Aequan (IT, fatturazione EU). */
export function hostedCheckoutBase(
  origin: string,
  userId: string,
): Pick<
  Stripe.Checkout.SessionCreateParams,
  | "locale"
  | "client_reference_id"
  | "billing_address_collection"
  | "tax_id_collection"
  | "customer_update"
  | "success_url"
  | "cancel_url"
  | "allow_promotion_codes"
> {
  const base = origin.replace(/\/$/, "");
  return {
    locale: "it",
    client_reference_id: userId,
    billing_address_collection: "required",
    tax_id_collection: { enabled: true },
    customer_update: { address: "auto", name: "auto" },
    allow_promotion_codes: false,
    success_url: `${base}/dashboard/billing?billing=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/dashboard/billing?billing=canceled`,
  };
}
