import "server-only";
import { prisma } from "@/lib/prisma";
import { completedPerformanceSessionWhere } from "@/lib/session-report-performance";
import { getUserBillingProfile } from "@/lib/billing/user-billing";
import { getCreditBalances } from "@/lib/billing/credit-ledger";
import { getReferralDashboard } from "@/lib/billing/referral";
import { hasPaidSaasSubscription } from "@/lib/billing/credit-policy";
import { hasUnlimitedCaseAccess } from "@/lib/billing/unlimited-case-access";
import { saasPlanDefinition, EXTRA_CREDIT_PACK } from "@/lib/billing/plans";
import { isStripeConfigured } from "@/lib/billing/stripe-client";

export async function getBillingDashboard(userId: string) {
  const [profile, credits, referral, completedCount, uniqueCases, creditHistory, extraPurchases] =
    await Promise.all([
      getUserBillingProfile(userId),
      getCreditBalances(userId),
      getReferralDashboard(userId),
      prisma.sessionReport.count({
        where: completedPerformanceSessionWhere({ userId }),
      }),
      prisma.sessionReport.findMany({
        where: completedPerformanceSessionWhere({ userId }),
        distinct: ["caseId"],
        select: { caseId: true },
      }),
      prisma.creditTransaction.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 30,
        select: {
          id: true,
          type: true,
          bucket: true,
          amount: true,
          createdAt: true,
          note: true,
        },
      }),
      prisma.creditTransaction.count({
        where: { userId, type: "EXTRA_PACK" },
      }),
    ]);

  const plan = saasPlanDefinition(profile?.planType ?? null);
  const subscribed = profile ? hasPaidSaasSubscription(profile) : false;
  const isAdmin = profile ? hasUnlimitedCaseAccess(profile) : false;
  const monthlyUsed = plan ? Math.max(0, plan.monthlyCredits - credits.monthlyBalance) : 0;
  const monthlyProgress = plan
    ? Math.min(100, Math.round((monthlyUsed / Math.max(1, plan.monthlyCredits)) * 100))
    : 0;

  return {
    stripeConfigured: isStripeConfigured(),
    subscribed,
    isAdmin,
    plan,
    planType: profile?.planType ?? "FREE",
    subscriptionStatus: profile?.subscriptionStatus ?? null,
    currentPeriodEnd: profile?.currentPeriodEnd?.toISOString() ?? null,
    cancelAtPeriodEnd: profile?.cancelAtPeriodEnd ?? false,
    firstPaidAt: profile?.firstPaidAt?.toISOString() ?? null,
    credits,
    extraPack: EXTRA_CREDIT_PACK,
    monthlyUsed,
    monthlyProgress,
    completedCount,
    uniqueCases: uniqueCases.length,
    extraPurchases,
    creditHistory,
    referral,
  };
}
