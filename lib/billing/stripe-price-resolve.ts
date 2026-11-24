import "server-only";
import { getStripeClient } from "@/lib/billing/stripe-client";

const resolvedCache = new Map<string, string>();

export function stripePriceKindError(raw: string | undefined): string | null {
  const id = raw?.trim() ?? "";
  if (id.startsWith("prod_")) {
    return `Hai inserito un Product ID (${id}). In Vercel serve il Price ID che inizia con price_ (Catalogo prodotti → prezzo).`;
  }
  return null;
}

/** Turns `prod_...` env values into the active Stripe Price ID used by Checkout. */
export async function resolveStripePriceId(
  raw: string | undefined,
  kind: "recurring" | "one_time",
): Promise<string | undefined> {
  const id = raw?.trim();
  if (!id) return undefined;
  if (id.startsWith("price_")) return id;

  const cacheKey = `${id}:${kind}`;
  const cached = resolvedCache.get(cacheKey);
  if (cached) return cached;

  if (!id.startsWith("prod_")) return id;

  const stripe = getStripeClient();
  const listed = await stripe.prices.list({ product: id, active: true, limit: 20 });
  const match =
    listed.data.find((price) => {
      if (price.currency !== "eur") return false;
      if (kind === "one_time") return price.type === "one_time";
      return price.type === "recurring" && price.recurring?.interval === "month";
    }) ?? listed.data[0];

  if (!match?.id) return undefined;
  resolvedCache.set(cacheKey, match.id);
  return match.id;
}
