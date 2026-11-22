import "server-only";
import type Stripe from "stripe";
import { config } from "@/lib/config";
import type { PlanType } from "@/lib/billing/plans";
import {
  appendPurchasedBundle,
  applySubscriptionUpdate,
  revokeSubscription,
} from "@/lib/billing/user-billing";
import { createLogger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

const log = createLogger("stripe-webhook");

function planFromPriceId(priceId: string | undefined): PlanType | null {
  if (!priceId) return null;
  if (priceId === config.STRIPE_PRICE_STUDENT) return "STUDENT";
  if (priceId === config.STRIPE_PRICE_PREMIUM) return "PREMIUM";
  return null;
}

function checkoutEmail(session: Stripe.Checkout.Session): string | null {
  const raw = session.customer_details?.email ?? session.customer_email ?? null;
  const email = raw?.trim().toLowerCase();
  return email || null;
}

async function resolveCheckoutUserId(session: Stripe.Checkout.Session): Promise<string | null> {
  const fromMetadata = session.metadata?.userId?.trim();
  if (fromMetadata) return fromMetadata;

  const customerId =
    typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;
  if (customerId) {
    const byCustomer = await prisma.user.findFirst({
      where: { stripeCustomerId: customerId },
      select: { id: true },
    });
    if (byCustomer) return byCustomer.id;
  }

  const email = checkoutEmail(session);
  if (email) {
    const byEmail = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (byEmail) return byEmail.id;
  }

  return null;
}

export async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session): Promise<void> {
  const customerId =
    typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;
  const userId = await resolveCheckoutUserId(session);

  if (!userId) {
    log.error("checkout.session.completed user not resolved", {
      code: "STRIPE_USER_UNRESOLVED",
      sessionId: session.id,
      stripeCustomerId: customerId,
      email: checkoutEmail(session),
    });
    return;
  }

  if (session.mode === "subscription" && session.subscription) {
    if (!customerId) {
      log.error("checkout.session.completed subscription missing customer", {
        code: "STRIPE_CUSTOMER_MISSING",
        sessionId: session.id,
        userId,
      });
      return;
    }
    const subscriptionId =
      typeof session.subscription === "string" ? session.subscription : session.subscription.id;
    const planType = (session.metadata?.planType as PlanType | undefined) ?? "STUDENT";

    await applySubscriptionUpdate({
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      subscriptionStatus: "active",
      planType,
    });
    return;
  }

  if (session.mode === "payment") {
    const bundleId = session.metadata?.bundleId;
    if (bundleId) {
      await appendPurchasedBundle(userId, bundleId);
    }
  }
}

export async function handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id ?? null;

  if (!customerId) return;

  const priceId = subscription.items.data[0]?.price?.id;
  const planType = planFromPriceId(priceId);
  if (!planType) {
    log.error("subscription price does not match a known plan; planType preserved", {
      code: "STRIPE_UNKNOWN_PRICE",
      subscriptionId: subscription.id,
      stripeCustomerId: customerId,
      priceId: priceId ?? null,
    });
  }

  await applySubscriptionUpdate({
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscription.id,
    subscriptionStatus: subscription.status,
    ...(planType ? { planType } : {}),
  });
}

export async function handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id ?? null;

  if (!customerId) return;
  await revokeSubscription(customerId);
}
