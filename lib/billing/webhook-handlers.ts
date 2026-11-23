import "server-only";
import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import {
  appendPurchasedBundle,
  applySubscriptionUpdate,
  revokeSubscription,
} from "@/lib/billing/user-billing";
import { toStoredPlanType, EXTRA_CREDIT_PACK, type SaasPlanId } from "@/lib/billing/plans";
import { planFromPriceId } from "@/lib/billing/stripe-prices";
import {
  applyPlanChangeCap,
  grantMonthlyCredits,
  grantPurchasedPack,
  revokeCredits,
} from "@/lib/billing/credit-ledger";
import {
  attachCheckoutToReferral,
  confirmReferralRewards,
  reconcileReferralRewards,
  revokeReferralRewards,
} from "@/lib/billing/referral";
import {
  invoicePeriodStart,
  paymentFingerprintFromCharge,
  stripeCustomerId,
  subscriptionPeriod,
} from "@/lib/billing/stripe-period";
import { getStripeClient } from "@/lib/billing/stripe-client";

const log = createLogger("stripe-webhook");

async function markEventProcessed(eventId: string, type: string): Promise<boolean> {
  try {
    await prisma.stripeProcessedEvent.create({
      data: { eventId, type },
    });
    return true;
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code?: unknown }).code)
        : "";
    if (code === "P2002") return false;
    throw error;
  }
}

async function releaseEvent(eventId: string): Promise<void> {
  await prisma.stripeProcessedEvent.delete({ where: { eventId } }).catch(() => undefined);
}

export async function withStripeEvent(
  event: Pick<Stripe.Event, "id" | "type">,
  handler: () => Promise<void>,
): Promise<"processed" | "duplicate"> {
  const claimed = await markEventProcessed(event.id, event.type);
  if (!claimed) return "duplicate";
  try {
    await handler();
    return "processed";
  } catch (error) {
    await releaseEvent(event.id);
    throw error;
  }
}

function checkoutEmail(session: Stripe.Checkout.Session): string | null {
  const raw = session.customer_details?.email ?? session.customer_email ?? null;
  const email = raw?.trim().toLowerCase();
  return email || null;
}

async function resolveCheckoutUserId(session: Stripe.Checkout.Session): Promise<string | null> {
  const fromMetadata = session.metadata?.userId?.trim();
  if (fromMetadata) return fromMetadata;

  const customerId = stripeCustomerId(session.customer);
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

async function resolveUserByCustomer(customerId: string | null): Promise<{
  id: string;
  firstPaidAt: Date | null;
} | null> {
  if (!customerId) return null;
  return prisma.user.findFirst({
    where: { stripeCustomerId: customerId },
    select: { id: true, firstPaidAt: true },
  });
}

async function markFirstPaid(userId: string, fingerprint: string | null): Promise<boolean> {
  const result = await prisma.user.updateMany({
    where: { id: userId, firstPaidAt: null },
    data: {
      firstPaidAt: new Date(),
      ...(fingerprint ? { stripePaymentFingerprint: fingerprint } : {}),
    },
  });
  return result.count > 0;
}

function planFromMetadata(raw: string | null | undefined): SaasPlanId | null {
  const p = (raw ?? "").trim().toUpperCase();
  if (p === "START" || p === "STUDENT") return "START";
  if (p === "PLUS" || p === "PREMIUM") return "PLUS";
  return null;
}

export async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session): Promise<void> {
  const customerId = stripeCustomerId(session.customer);
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
    const planType =
      planFromMetadata(session.metadata?.planType) ??
      planFromMetadata(session.metadata?.plan) ??
      "START";

    await applySubscriptionUpdate({
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      subscriptionStatus: "active",
      planType: toStoredPlanType(planType),
    });
    await attachCheckoutToReferral({
      inviteeUserId: userId,
      checkoutSessionId: session.id,
      stripeCustomerId: customerId,
    });
    return;
  }

  if (session.mode === "payment") {
    const kind = session.metadata?.kind ?? session.metadata?.bundleId;
    if (kind === EXTRA_CREDIT_PACK.id || session.metadata?.product === "extra_credits") {
      await grantPurchasedPack({
        userId,
        paymentRef: session.id,
        sourceId: session.payment_intent
          ? typeof session.payment_intent === "string"
            ? session.payment_intent
            : session.payment_intent.id
          : session.id,
      });
      return;
    }
    const bundleId = session.metadata?.bundleId;
    if (bundleId) {
      await appendPurchasedBundle(userId, bundleId);
    }
  }
}

export async function handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
  const customerId = stripeCustomerId(subscription.customer);
  if (!customerId) return;

  const priceId = subscription.items.data[0]?.price?.id;
  const plan = planFromPriceId(priceId) ?? planFromMetadata(subscription.metadata?.planType);
  const period = subscriptionPeriod(subscription);

  if (!plan && priceId) {
    log.error("subscription price does not match a known plan; planType preserved", {
      code: "STRIPE_UNKNOWN_PRICE",
      subscriptionId: subscription.id,
      stripeCustomerId: customerId,
      priceId,
    });
  }

  await applySubscriptionUpdate({
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscription.id,
    subscriptionStatus: subscription.status,
    ...(plan ? { planType: toStoredPlanType(plan) } : {}),
    currentPeriodEnd: period.end,
    cancelAtPeriodEnd: period.cancelAtPeriodEnd,
  });

  const user = await resolveUserByCustomer(customerId);
  if (user && plan) {
    await applyPlanChangeCap({
      userId: user.id,
      plan,
      sourceId: `${subscription.id}:${priceId ?? "unknown"}`,
    });
  }
}

export async function handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
  const customerId = stripeCustomerId(subscription.customer);
  if (!customerId) return;
  await revokeSubscription(customerId);
}

export async function handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
  const customerId = stripeCustomerId(invoice.customer);
  const user = await resolveUserByCustomer(customerId);
  if (!user) {
    log.error("invoice.paid user not resolved", {
      invoiceId: invoice.id,
      stripeCustomerId: customerId,
    });
    return;
  }

  const reason = invoice.billing_reason;
  const subscriptionIdRaw =
    (invoice as { subscription?: string | Stripe.Subscription | null }).subscription ?? null;
  const subscriptionId =
    typeof subscriptionIdRaw === "string"
      ? subscriptionIdRaw
      : subscriptionIdRaw?.id ?? null;

  let plan: SaasPlanId | null = null;
  if (subscriptionId) {
    try {
      const stripe = getStripeClient();
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const priceId = subscription.items.data[0]?.price?.id;
      plan = planFromPriceId(priceId) ?? planFromMetadata(subscription.metadata?.planType);
      const period = subscriptionPeriod(subscription);
      if (customerId) {
        await applySubscriptionUpdate({
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscription.id,
          subscriptionStatus: subscription.status,
          ...(plan ? { planType: toStoredPlanType(plan) } : {}),
          currentPeriodEnd: period.end,
          cancelAtPeriodEnd: period.cancelAtPeriodEnd,
        });
      }
    } catch (error) {
      log.warn("invoice.paid could not retrieve subscription", {
        invoiceId: invoice.id,
        error,
      });
    }
  }

  const isSubscriptionGrant =
    reason === "subscription_create" || reason === "subscription_cycle";
  if (isSubscriptionGrant && plan) {
    await grantMonthlyCredits({
      userId: user.id,
      plan,
      periodStart: invoicePeriodStart(invoice),
      paymentRef: invoice.id,
      sourceId: invoice.id,
    });
  }

  const invoiceCharge = (invoice as { charge?: string | { id?: string } | null }).charge;
  const chargeId =
    typeof invoiceCharge === "string" ? invoiceCharge : invoiceCharge?.id ?? null;
  let fingerprint: string | null = null;
  if (chargeId) {
    try {
      const charge = await getStripeClient().charges.retrieve(chargeId);
      fingerprint = paymentFingerprintFromCharge(charge);
    } catch {
      fingerprint = null;
    }
  }

  const isFirstPaid = await markFirstPaid(user.id, fingerprint);
  if (isFirstPaid && (reason === "subscription_create" || reason === "subscription_update")) {
    try {
      await confirmReferralRewards({
        inviteeUserId: user.id,
        stripeCustomerId: customerId,
        paymentFingerprint: fingerprint,
        checkoutSessionId: invoice.id,
      });
    } catch (error) {
      log.error("Referral confirm failed — will reconcile", {
        userId: user.id,
        invoiceId: invoice.id,
        error,
      });
      const pending = await prisma.referralRedemption.findUnique({
        where: { inviteeUserId: user.id },
        select: { id: true, status: true },
      });
      if (pending?.status === "CONFIRMED") {
        await reconcileReferralRewards(pending.id);
      } else {
        throw error;
      }
    }
  }
}

export async function handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
  const customerId = stripeCustomerId(invoice.customer);
  if (!customerId) return;
  await prisma.user.updateMany({
    where: { stripeCustomerId: customerId },
    data: { subscriptionStatus: "past_due" },
  });
}

export async function handleChargeRefunded(charge: Stripe.Charge): Promise<void> {
  const customerId = stripeCustomerId(charge.customer);
  const user = await resolveUserByCustomer(customerId);
  if (!user) return;

  const paymentRef = charge.id;
  const chargeInvoice = (charge as { invoice?: string | { id?: string } | null }).invoice;
  const invoiceId =
    typeof chargeInvoice === "string" ? chargeInvoice : chargeInvoice?.id ?? null;

  const extraTxn = await prisma.creditTransaction.findFirst({
    where: {
      userId: user.id,
      type: "EXTRA_PACK",
      OR: [{ paymentRef }, { sourceId: paymentRef }],
    },
  });
  if (extraTxn) {
    await revokeCredits({
      userId: user.id,
      bucket: "PURCHASED",
      amount: EXTRA_CREDIT_PACK.credits,
      idempotencyKey: `refund-extra:${paymentRef}`,
      paymentRef,
      note: "Revoca pacchetto extra per rimborso",
    });
  }

  if (invoiceId || charge.metadata?.kind === "subscription") {
    const monthlyGrant = await prisma.creditTransaction.findFirst({
      where: {
        userId: user.id,
        type: "MONTHLY_GRANT",
        ...(invoiceId ? { paymentRef: invoiceId } : {}),
      },
      orderBy: { createdAt: "desc" },
    });
    if (monthlyGrant && monthlyGrant.amount > 0) {
      await revokeCredits({
        userId: user.id,
        bucket: "MONTHLY",
        amount: monthlyGrant.amount,
        idempotencyKey: `refund-monthly:${invoiceId ?? paymentRef}`,
        paymentRef,
        note: "Revoca crediti mensili per rimborso",
      });
    }
    await revokeReferralRewards({
      inviteeUserId: user.id,
      paymentRef,
    });
  }
}

export async function handleDisputeCreated(dispute: Stripe.Dispute): Promise<void> {
  const chargeId = typeof dispute.charge === "string" ? dispute.charge : dispute.charge?.id;
  if (!chargeId) return;
  try {
    const charge = await getStripeClient().charges.retrieve(chargeId);
    await handleChargeRefunded(charge);
  } catch (error) {
    log.error("dispute.created charge retrieve failed", { disputeId: dispute.id, error });
  }
}

export async function handleEarlyFraudWarning(
  warning: Stripe.Radar.EarlyFraudWarning,
): Promise<void> {
  const chargeId = typeof warning.charge === "string" ? warning.charge : warning.charge?.id;
  if (!chargeId) return;
  try {
    const charge = await getStripeClient().charges.retrieve(chargeId);
    await handleChargeRefunded(charge);
  } catch (error) {
    log.error("early_fraud_warning charge retrieve failed", { warningId: warning.id, error });
  }
}
