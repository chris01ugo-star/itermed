import "server-only";
import { prisma } from "@/lib/prisma";
import { SAAS_PLANS } from "@/lib/billing/plans";
import { completedPerformanceSessionWhere } from "@/lib/session-report-performance";

export async function fetchMonetizationMetrics() {
  const [
    startActive,
    plusActive,
    canceled,
    pastDue,
    extraPacks,
    creditsGranted,
    creditsUsed,
    simulationsCompleted,
    referralsTotal,
    referralsConfirmed,
    referralBonus,
    failedPayments,
    suspiciousReferrals,
    wallets,
  ] = await Promise.all([
    prisma.user.count({
      where: {
        planType: { in: ["STUDENT", "START"] },
        subscriptionStatus: { in: ["active", "trialing"] },
      },
    }),
    prisma.user.count({
      where: {
        planType: { in: ["PREMIUM", "PLUS"] },
        subscriptionStatus: { in: ["active", "trialing"] },
      },
    }),
    prisma.user.count({ where: { subscriptionStatus: "canceled" } }),
    prisma.user.count({ where: { subscriptionStatus: "past_due" } }),
    prisma.creditTransaction.count({ where: { type: "EXTRA_PACK" } }),
    prisma.creditTransaction.aggregate({
      where: { amount: { gt: 0 } },
      _sum: { amount: true },
    }),
    prisma.creditTransaction.aggregate({
      where: { type: "SIMULATION_USE" },
      _sum: { amount: true },
    }),
    prisma.sessionReport.count({ where: completedPerformanceSessionWhere() }),
    prisma.referralRedemption.count(),
    prisma.referralRedemption.count({ where: { status: "CONFIRMED" } }),
    prisma.creditTransaction.aggregate({
      where: { type: { in: ["REFERRAL_INVITER", "REFERRAL_INVITEE"] } },
      _sum: { amount: true },
    }),
    prisma.user.count({ where: { subscriptionStatus: "past_due" } }),
    prisma.referralRedemption.count({ where: { status: "INVALID" } }),
    prisma.creditWallet.aggregate({
      _sum: {
        monthlyBalance: true,
        purchasedBalance: true,
        referralBalance: true,
      },
    }),
  ]);

  const mrrCents =
    startActive * SAAS_PLANS.START.monthlyPriceCents +
    plusActive * SAAS_PLANS.PLUS.monthlyPriceCents;

  return {
    startActive,
    plusActive,
    canceled,
    pastDue,
    extraPacks,
    creditsGranted: creditsGranted._sum.amount ?? 0,
    creditsUsed: Math.abs(creditsUsed._sum.amount ?? 0),
    creditsOutstanding:
      (wallets._sum.monthlyBalance ?? 0) +
      (wallets._sum.purchasedBalance ?? 0) +
      (wallets._sum.referralBalance ?? 0),
    simulationsCompleted,
    referralsTotal,
    referralsConfirmed,
    referralBonus: referralBonus._sum.amount ?? 0,
    failedPayments,
    suspiciousReferrals,
    estimatedMrrEuro: (mrrCents / 100).toFixed(2),
    collectedNote:
      "L'MRR è stimato dai piani attivi in database, non dagli incassi Stripe. I ricavi effettivamente incassati si leggono dalla Dashboard Stripe / bilancio.",
  };
}

export async function listRecentCreditAudits(take = 30) {
  return prisma.creditAdminAudit.findMany({
    orderBy: { createdAt: "desc" },
    take,
  });
}
