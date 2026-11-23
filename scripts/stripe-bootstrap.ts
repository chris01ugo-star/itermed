/**
 * Crea (o riusa) i prodotti/prezzi Aequan in Stripe TEST e configura il Customer Portal.
 *
 *   STRIPE_SECRET_KEY=sk_test_... npx tsx scripts/stripe-bootstrap.ts
 *
 * Non stampa la secret key. Gli ID prezzo vanno in Vercel / .env.local, mai committati con sk_*.
 */
import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import Stripe from "stripe";
import { EXTRA_CREDIT_PACK, SAAS_PLANS } from "@/lib/billing/plans";

loadEnv({ path: resolve(process.cwd(), ".env.local") });
loadEnv({ path: resolve(process.cwd(), ".env") });

const APP_ORIGIN = (process.env.APP_URL ?? "https://www.aequan.it").replace(/\/$/, "");

type CatalogSku = "aequan_start" | "aequan_plus" | "aequan_extra_credits_5";

type CatalogSpec = {
  sku: CatalogSku;
  name: string;
  description: string;
  unitAmount: number;
  recurring?: { interval: "month" };
};

const CATALOG: CatalogSpec[] = [
  {
    sku: "aequan_start",
    name: SAAS_PLANS.START.displayName,
    description:
      "Abbonamento mensile: 12 crediti simulazione (cap 24). Formazione sanitaria, non uso clinico.",
    unitAmount: SAAS_PLANS.START.monthlyPriceCents,
    recurring: { interval: "month" },
  },
  {
    sku: "aequan_plus",
    name: SAAS_PLANS.PLUS.displayName,
    description:
      "Abbonamento mensile: 30 crediti simulazione (cap 60). Formazione sanitaria, non uso clinico.",
    unitAmount: SAAS_PLANS.PLUS.monthlyPriceCents,
    recurring: { interval: "month" },
  },
  {
    sku: "aequan_extra_credits_5",
    name: EXTRA_CREDIT_PACK.displayName,
    description: "Pacchetto una tantum: 5 crediti simulazione extra. Richiede abbonamento attivo.",
    unitAmount: EXTRA_CREDIT_PACK.priceCents,
  },
];

function requireTestSecret(): string {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) {
    throw new Error("Imposta STRIPE_SECRET_KEY (sk_test_...) prima di eseguire lo script.");
  }
  if (!key.startsWith("sk_test_")) {
    throw new Error("Questo bootstrap gira solo in test mode (chiave sk_test_...).");
  }
  return key;
}

function priceMatches(price: Stripe.Price, spec: CatalogSpec): boolean {
  if (!price.active) return false;
  if (price.currency !== "eur") return false;
  if (price.unit_amount !== spec.unitAmount) return false;
  if (spec.recurring) {
    return price.type === "recurring" && price.recurring?.interval === spec.recurring.interval;
  }
  return price.type === "one_time";
}

async function findOrCreateProduct(stripe: Stripe, spec: CatalogSpec): Promise<Stripe.Product> {
  const listed = await stripe.products.list({ limit: 100, active: true });
  const existing = listed.data.find((product) => product.metadata?.aequan_sku === spec.sku);
  if (existing) {
    await stripe.products.update(existing.id, {
      name: spec.name,
      description: spec.description,
      metadata: { aequan_sku: spec.sku },
    });
    return existing;
  }
  return stripe.products.create({
    name: spec.name,
    description: spec.description,
    metadata: { aequan_sku: spec.sku },
    tax_code: "txcd_10000000",
  });
}

async function findOrCreatePrice(
  stripe: Stripe,
  product: Stripe.Product,
  spec: CatalogSpec,
): Promise<Stripe.Price> {
  const prices = await stripe.prices.list({ product: product.id, active: true, limit: 100 });
  const match = prices.data.find((price) => priceMatches(price, spec));
  if (match) return match;
  return stripe.prices.create({
    product: product.id,
    currency: "eur",
    unit_amount: spec.unitAmount,
    nickname: spec.name,
    metadata: { aequan_sku: spec.sku },
    tax_behavior: "inclusive",
    ...(spec.recurring ? { recurring: { interval: spec.recurring.interval } } : {}),
  });
}

async function configurePortal(
  stripe: Stripe,
  products: Array<{ productId: string; priceId: string; recurring: boolean }>,
): Promise<string> {
  const subscriptionProducts = products
    .filter((row) => row.recurring)
    .map((row) => ({ product: row.productId, prices: [row.priceId] }));

  const payload: Stripe.BillingPortal.ConfigurationCreateParams = {
    business_profile: {
      headline: "Aequan — abbonamento e fatture",
      privacy_policy_url: `${APP_ORIGIN}/privacy`,
      terms_of_service_url: `${APP_ORIGIN}/terms`,
    },
    features: {
      customer_update: {
        enabled: true,
        allowed_updates: ["email", "address", "name", "tax_id"],
      },
      invoice_history: { enabled: true },
      payment_method_update: { enabled: true },
      subscription_cancel: {
        enabled: true,
        mode: "at_period_end",
        proration_behavior: "none",
      },
      subscription_update: {
        enabled: true,
        default_allowed_updates: ["price"],
        proration_behavior: "create_prorations",
        products: subscriptionProducts,
      },
    },
  };

  const existing = await stripe.billingPortal.configurations.list({ limit: 10 });
  const current = existing.data.find((row) => row.is_default) ?? existing.data.find((row) => row.active);
  if (current) {
    await stripe.billingPortal.configurations.update(current.id, payload);
    return current.id;
  }
  const created = await stripe.billingPortal.configurations.create({
    ...payload,
    default_return_url: `${APP_ORIGIN}/dashboard/billing`,
  });
  return created.id;
}

async function main(): Promise<void> {
  const stripe = new Stripe(requireTestSecret(), {
    typescript: true,
    appInfo: { name: "Aequan", url: "https://www.aequan.it" },
  });

  const envRows: Record<string, string> = {};
  const catalogRows: Array<{ productId: string; priceId: string; recurring: boolean }> = [];

  for (const spec of CATALOG) {
    const product = await findOrCreateProduct(stripe, spec);
    const price = await findOrCreatePrice(stripe, product, spec);
    catalogRows.push({
      productId: product.id,
      priceId: price.id,
      recurring: Boolean(spec.recurring),
    });
    if (spec.sku === "aequan_start") envRows.STRIPE_PRICE_START = price.id;
    if (spec.sku === "aequan_plus") envRows.STRIPE_PRICE_PLUS = price.id;
    if (spec.sku === "aequan_extra_credits_5") envRows.STRIPE_PRICE_EXTRA_CREDITS = price.id;
    console.log(`${spec.sku}: product=${product.id} price=${price.id}`);
  }

  const portalId = await configurePortal(stripe, catalogRows);
  console.log(`portal_configuration=${portalId}`);
  console.log("--- env (senza secret) ---");
  for (const [key, value] of Object.entries(envRows)) {
    console.log(`${key}=${value}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
