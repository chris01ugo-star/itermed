import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/api-session";
import { config } from "@/lib/config";
import { CheckoutBodySchema } from "@/lib/billing/schemas";
import { getOrCreateStripeCustomer, getUserBillingProfile } from "@/lib/billing/user-billing";
import { getStripeClient, isStripeConfigured } from "@/lib/billing/stripe-client";
import { EXTRA_CREDIT_PACK, toSaasPlanId, toStoredPlanType } from "@/lib/billing/plans";
import { extraCreditsPriceId, priceIdForPlan } from "@/lib/billing/stripe-prices";
import { resolveStripePriceId, stripePriceKindError } from "@/lib/billing/stripe-price-resolve";
import { hostedCheckoutBase } from "@/lib/billing/stripe-checkout-session";
import { applyReferralCode, attachCheckoutToReferral } from "@/lib/billing/referral";
import { hasActiveSubscription } from "@/lib/billing/access-gate";
import { hasPaidSaasSubscription } from "@/lib/billing/credit-policy";

export const runtime = "nodejs";

function checkoutErrorMessage(err: unknown): string {
  if (err && typeof err === "object" && "message" in err) {
    const message = (err as { message: unknown }).message;
    if (typeof message === "string" && message.trim()) {
      const prodHint = message.match(/No such price: '(prod_[^']+)'/i);
      if (prodHint?.[1]) {
        return (
          stripePriceKindError(prodHint[1]) ??
          message.trim().slice(0, 280)
        );
      }
      return message.trim().slice(0, 280);
    }
  }
  return "Checkout Stripe non riuscito. Controlla le chiavi test e i Price ID su Vercel, poi riprova.";
}

export async function POST(request: Request) {
  try {
    return await createCheckoutResponse(request);
  } catch (err) {
    console.error("[billing/checkout]", err);
    return NextResponse.json({ error: checkoutErrorMessage(err) }, { status: 502 });
  }
}

async function createCheckoutResponse(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "Pagamenti non configurati. Contatta Aequan per attivare Stripe." },
      { status: 503 },
    );
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = CheckoutBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((i) => i.message).join("; ") },
      { status: 400 },
    );
  }

  const profile = await getUserBillingProfile(userId);
  if (!profile) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const customerId = await getOrCreateStripeCustomer(profile);
  const stripe = getStripeClient();
  const origin = config.APP_URL.replace(/\/$/, "");
  const checkoutBase = hostedCheckoutBase(origin, userId);

  if (parsed.data.type === "extra_credits") {
    if (!hasPaidSaasSubscription(profile)) {
      return NextResponse.json(
        {
          error: "I crediti extra richiedono un abbonamento attivo.",
          code: "SUBSCRIPTION_REQUIRED",
        },
        { status: 402 },
      );
    }
    const extraRaw = extraCreditsPriceId();
    const priceId = await resolveStripePriceId(extraRaw, "one_time");
    if (!priceId) {
      return NextResponse.json(
        {
          error:
            stripePriceKindError(extraRaw) ??
            "Prezzo pacchetto extra non configurato (STRIPE_PRICE_EXTRA_CREDITS).",
        },
        { status: 400 },
      );
    }
    const session = await stripe.checkout.sessions.create({
      ...checkoutBase,
      customer: customerId,
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      invoice_creation: { enabled: true },
      metadata: {
        userId,
        kind: EXTRA_CREDIT_PACK.id,
        product: "extra_credits",
      },
    });
    if (!session.url) {
      return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
    }
    return NextResponse.json({ url: session.url, sessionId: session.id });
  }

  if (parsed.data.type === "bundle") {
    const priceId = config.STRIPE_BUNDLE_PRICES[parsed.data.bundleId];
    if (!priceId) {
      return NextResponse.json({ error: "Price not configured for this product" }, { status: 400 });
    }
    const session = await stripe.checkout.sessions.create({
      ...checkoutBase,
      customer: customerId,
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      invoice_creation: { enabled: true },
      metadata: { userId, bundleId: parsed.data.bundleId },
    });
    if (!session.url) {
      return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
    }
    return NextResponse.json({ url: session.url, sessionId: session.id });
  }

  const plan = toSaasPlanId(parsed.data.plan);
  if (!plan) {
    return NextResponse.json({ error: "Piano non valido" }, { status: 400 });
  }
  const planRaw = priceIdForPlan(plan);
  const priceId = await resolveStripePriceId(planRaw, "recurring");
  if (!priceId) {
    return NextResponse.json(
      {
        error:
          stripePriceKindError(planRaw) ??
          "Prezzo abbonamento non configurato. Imposta STRIPE_PRICE_START / STRIPE_PRICE_PLUS (oppure STUDENT/PREMIUM).",
      },
      { status: 400 },
    );
  }

  const storedPlan = toStoredPlanType(plan);
  const currentPlan = toSaasPlanId(profile.planType);

  if (hasActiveSubscription(profile) && profile.stripeSubscriptionId) {
    if (currentPlan === plan) {
      return NextResponse.json(
        { error: "Sei già iscritto a questo piano." },
        { status: 409 },
      );
    }
    await stripe.subscriptions.update(profile.stripeSubscriptionId, {
      items: [
        {
          id: (await stripe.subscriptions.retrieve(profile.stripeSubscriptionId)).items.data[0]
            ?.id,
          price: priceId,
        },
      ],
      proration_behavior: "create_prorations",
      metadata: { userId, planType: storedPlan, saasPlan: plan },
    });
    return NextResponse.json({
      url: `${origin}/dashboard/billing?billing=plan-updated`,
      upgraded: true,
    });
  }

  if (parsed.data.referralCode?.trim() && !profile.firstPaidAt) {
    const applied = await applyReferralCode({
      inviteeUserId: userId,
      code: parsed.data.referralCode,
    });
    if (!applied.ok) {
      return NextResponse.json(
        { error: applied.message, code: applied.code },
        { status: 400 },
      );
    }
  }

  const session = await stripe.checkout.sessions.create({
    ...checkoutBase,
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    metadata: {
      userId,
      planType: storedPlan,
      saasPlan: plan,
    },
    subscription_data: {
      metadata: { userId, planType: storedPlan, saasPlan: plan },
    },
  });

  if (!session.url) {
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
  }

  if (parsed.data.referralCode?.trim() && !profile.firstPaidAt) {
    await attachCheckoutToReferral({
      inviteeUserId: userId,
      checkoutSessionId: session.id,
      stripeCustomerId: customerId,
    });
  }

  return NextResponse.json({ url: session.url, sessionId: session.id });
}
