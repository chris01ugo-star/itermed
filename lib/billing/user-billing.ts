import "server-only";
import { prisma } from "@/lib/prisma";
import { getStripeClient, isStripeConfigured } from "@/lib/billing/stripe-client";
import type { PlanType } from "@/lib/billing/plans";

export type UserBillingProfile = {
  id: string;
  email: string;
  role: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  subscriptionStatus: string | null;
  planType: PlanType | string;
  freeTrialUsageCount: number;
  purchasedBundleIds: string[];
};

const billingSelect = {
  id: true,
  email: true,
  role: true,
  stripeCustomerId: true,
  stripeSubscriptionId: true,
  subscriptionStatus: true,
  planType: true,
  freeTrialUsageCount: true,
  purchasedBundleIds: true,
} as const;

export async function getUserBillingProfile(userId: string): Promise<UserBillingProfile | null> {
  return prisma.user.findUnique({
    where: { id: userId },
    select: billingSelect,
  });
}

export async function getOrCreateStripeCustomer(user: UserBillingProfile): Promise<string> {
  if (user.stripeCustomerId) return user.stripeCustomerId;
  if (!isStripeConfigured()) {
    throw new Error("Stripe is not configured");
  }

  const stripe = getStripeClient();
  const customer = await stripe.customers.create({
    email: user.email,
    metadata: { userId: user.id },
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { stripeCustomerId: customer.id },
  });

  return customer.id;
}

export async function incrementFreeTrialUsage(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { freeTrialUsageCount: { increment: 1 } },
  });
}

/**
 * Atomically consumes one free-trial start when `freeTrialUsageCount` is still under the limit.
 * Returns false if the trial was already exhausted (race with a concurrent start).
 */
export async function tryConsumeFreeTrialUsage(
  userId: string,
  limit: number,
): Promise<boolean> {
  const result = await prisma.user.updateMany({
    where: {
      id: userId,
      freeTrialUsageCount: { lt: limit },
    },
    data: { freeTrialUsageCount: { increment: 1 } },
  });
  return result.count > 0;
}

export async function applySubscriptionUpdate(params: {
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  subscriptionStatus: string;
  planType: PlanType;
}): Promise<void> {
  await prisma.user.updateMany({
    where: { stripeCustomerId: params.stripeCustomerId },
    data: {
      stripeSubscriptionId: params.stripeSubscriptionId,
      subscriptionStatus: params.subscriptionStatus,
      planType: params.planType,
    },
  });
}

export async function revokeSubscription(stripeCustomerId: string): Promise<void> {
  await prisma.user.updateMany({
    where: { stripeCustomerId },
    data: {
      stripeSubscriptionId: null,
      subscriptionStatus: "canceled",
      planType: "FREE",
    },
  });
}

export async function appendPurchasedBundle(userId: string, bundleId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { purchasedBundleIds: true },
  });
  if (!user) return;

  if (user.purchasedBundleIds.includes(bundleId)) return;

  await prisma.user.update({
    where: { id: userId },
    data: { purchasedBundleIds: { push: bundleId } },
  });
}
