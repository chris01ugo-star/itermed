import "server-only";
import { prisma } from "@/lib/prisma";
import { generateReferralCode, normalizeReferralCode } from "@/lib/billing/referral-code";
import {
  REFERRAL_INVITEE_BONUS,
  REFERRAL_INVITER_BONUS,
} from "@/lib/billing/plans";
import { grantReferralBonus, revokeCredits } from "@/lib/billing/credit-ledger";
import { createLogger } from "@/lib/logger";

const log = createLogger("referral");

export {
  generateReferralCode,
  normalizeReferralCode,
  REFERRAL_CODE_PATTERN,
} from "@/lib/billing/referral-code";

const MAX_CODE_ATTEMPTS = 12;

export async function ensureReferralProfile(userId: string): Promise<{ code: string; suspended: boolean }> {
  const existing = await prisma.referralProfile.findUnique({ where: { userId } });
  if (existing) {
    return { code: existing.code, suspended: Boolean(existing.suspendedAt) };
  }

  for (let i = 0; i < MAX_CODE_ATTEMPTS; i += 1) {
    const code = generateReferralCode();
    try {
      const created = await prisma.referralProfile.create({
        data: { userId, code },
      });
      return { code: created.code, suspended: false };
    } catch (error) {
      const prismaCode =
        error && typeof error === "object" && "code" in error
          ? String((error as { code?: unknown }).code)
          : "";
      if (prismaCode !== "P2002") throw error;
    }
  }
  throw new Error("Unable to allocate a unique referral code");
}

export type ApplyReferralResult =
  | {
      ok: true;
      inviterUserId: string;
      message: string;
    }
  | { ok: false; code: string; message: string };

/**
 * Persist a pending referral before the first paid subscription checkout.
 * Rewards are granted only after invoice.paid of that first subscription.
 */
export async function applyReferralCode(params: {
  inviteeUserId: string;
  code: string;
  checkoutSessionId?: string;
}): Promise<ApplyReferralResult> {
  const code = normalizeReferralCode(params.code);
  if (!code) {
    return { ok: false, code: "INVALID_CODE", message: "Codice invito non valido." };
  }

  const invitee = await prisma.user.findUnique({
    where: { id: params.inviteeUserId },
    select: {
      id: true,
      firstPaidAt: true,
      stripeSubscriptionId: true,
      referralUsed: true,
    },
  });
  if (!invitee) {
    return { ok: false, code: "USER_NOT_FOUND", message: "Utente non trovato." };
  }
  if (invitee.firstPaidAt || invitee.referralUsed) {
    return {
      ok: false,
      code: "ALREADY_USED",
      message: "Hai già utilizzato un codice invito o un abbonamento precedente.",
    };
  }

  const profile = await prisma.referralProfile.findUnique({
    where: { code },
    include: { user: { select: { id: true, isActive: true } } },
  });
  if (!profile) {
    return { ok: false, code: "UNKNOWN_CODE", message: "Questo codice invito non esiste." };
  }
  if (profile.suspendedAt) {
    return {
      ok: false,
      code: "SUSPENDED",
      message: "Questo codice invito non è al momento disponibile.",
    };
  }
  if (profile.userId === params.inviteeUserId) {
    return {
      ok: false,
      code: "SELF_REFERRAL",
      message: "Non puoi utilizzare il tuo codice invito.",
    };
  }
  if (!profile.user.isActive) {
    return {
      ok: false,
      code: "INVITER_INACTIVE",
      message: "Questo codice invito non è al momento disponibile.",
    };
  }

  try {
    await prisma.referralRedemption.create({
      data: {
        inviterUserId: profile.userId,
        inviteeUserId: params.inviteeUserId,
        profileUserId: profile.userId,
        code,
        status: "PENDING",
        checkoutSessionId: params.checkoutSessionId ?? null,
      },
    });
  } catch (error) {
    const prismaCode =
      error && typeof error === "object" && "code" in error
        ? String((error as { code?: unknown }).code)
        : "";
    if (prismaCode === "P2002") {
      return {
        ok: false,
        code: "ALREADY_USED",
        message: "Hai già utilizzato un codice invito.",
      };
    }
    throw error;
  }

  return {
    ok: true,
    inviterUserId: profile.userId,
    message:
      "Codice valido! Dopo l'attivazione del tuo abbonamento riceverai 5 simulazioni bonus. Il collega che ti ha invitato ne riceverà 10.",
  };
}

export async function attachCheckoutToReferral(params: {
  inviteeUserId: string;
  checkoutSessionId: string;
  stripeCustomerId?: string | null;
}): Promise<void> {
  await prisma.referralRedemption.updateMany({
    where: {
      inviteeUserId: params.inviteeUserId,
      status: "PENDING",
    },
    data: {
      checkoutSessionId: params.checkoutSessionId,
      stripeCustomerId: params.stripeCustomerId ?? undefined,
    },
  });
}

/**
 * First paid subscription only. Atomic + idempotent for both bonus legs.
 * Same payment fingerprint on another account → INVALID, no rewards.
 */
export async function confirmReferralRewards(params: {
  inviteeUserId: string;
  stripeCustomerId?: string | null;
  paymentFingerprint?: string | null;
  checkoutSessionId?: string | null;
}): Promise<{ rewarded: boolean; reason?: string }> {
  const redemption = await prisma.referralRedemption.findUnique({
    where: { inviteeUserId: params.inviteeUserId },
  });
  if (!redemption) return { rewarded: false, reason: "no_redemption" };
  if (redemption.status === "CONFIRMED") return { rewarded: false, reason: "already_confirmed" };
  if (redemption.status === "CANCELED" || redemption.status === "INVALID") {
    return { rewarded: false, reason: redemption.status.toLowerCase() };
  }

  const profile = await prisma.referralProfile.findUnique({
    where: { userId: redemption.inviterUserId },
  });
  if (!profile || profile.suspendedAt) {
    await prisma.referralRedemption.update({
      where: { id: redemption.id },
      data: { status: "INVALID" },
    });
    return { rewarded: false, reason: "inviter_suspended" };
  }

  if (params.paymentFingerprint) {
    const collision = await prisma.referralRedemption.findFirst({
      where: {
        paymentFingerprint: params.paymentFingerprint,
        inviteeUserId: { not: params.inviteeUserId },
        status: { in: ["PENDING", "CONFIRMED"] },
      },
    });
    const sameCustomerUser = await prisma.user.findFirst({
      where: {
        stripePaymentFingerprint: params.paymentFingerprint,
        id: { not: params.inviteeUserId },
        firstPaidAt: { not: null },
      },
      select: { id: true },
    });
    if (collision || sameCustomerUser) {
      log.warn("Referral blocked: reused payment fingerprint", {
        inviteeUserId: params.inviteeUserId,
        fingerprint: params.paymentFingerprint,
      });
      await prisma.referralRedemption.update({
        where: { id: redemption.id },
        data: {
          status: "INVALID",
          paymentFingerprint: params.paymentFingerprint,
          stripeCustomerId: params.stripeCustomerId ?? redemption.stripeCustomerId,
        },
      });
      return { rewarded: false, reason: "fingerprint_collision" };
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string; status: string }>>`
        SELECT id, status FROM "ReferralRedemption" WHERE id = ${redemption.id} FOR UPDATE
      `;
      if (!locked[0] || locked[0].status !== "PENDING") {
        throw new Error("REFERRAL_NOT_PENDING");
      }
      await tx.referralRedemption.update({
        where: { id: redemption.id },
        data: {
          status: "CONFIRMED",
          rewardedAt: new Date(),
          stripeCustomerId: params.stripeCustomerId ?? redemption.stripeCustomerId,
          paymentFingerprint: params.paymentFingerprint ?? redemption.paymentFingerprint,
          checkoutSessionId: params.checkoutSessionId ?? redemption.checkoutSessionId,
        },
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "REFERRAL_NOT_PENDING") {
      return { rewarded: false, reason: "not_pending" };
    }
    throw error;
  }

  try {
    const inviter = await grantReferralBonus({
      userId: redemption.inviterUserId,
      role: "INVITER",
      redemptionId: redemption.id,
      amount: REFERRAL_INVITER_BONUS,
    });
    const invitee = await grantReferralBonus({
      userId: redemption.inviteeUserId,
      role: "INVITEE",
      redemptionId: redemption.id,
      amount: REFERRAL_INVITEE_BONUS,
    });
    if (inviter.skipped && invitee.skipped) {
      return { rewarded: false, reason: "already_granted" };
    }
    return { rewarded: true };
  } catch (error) {
    log.error("Referral reward grant failed — redemption stays CONFIRMED for reconcile", {
      redemptionId: redemption.id,
      error,
    });
    throw error;
  }
}

/** Reconcile CONFIRMED redemptions whose ledger rows are missing (webhook crash). */
export async function reconcileReferralRewards(redemptionId: string): Promise<void> {
  const redemption = await prisma.referralRedemption.findUnique({
    where: { id: redemptionId },
  });
  if (!redemption || redemption.status !== "CONFIRMED") return;
  await grantReferralBonus({
    userId: redemption.inviterUserId,
    role: "INVITER",
    redemptionId: redemption.id,
    amount: REFERRAL_INVITER_BONUS,
  });
  await grantReferralBonus({
    userId: redemption.inviteeUserId,
    role: "INVITEE",
    redemptionId: redemption.id,
    amount: REFERRAL_INVITEE_BONUS,
  });
}

export async function revokeReferralRewards(params: {
  inviteeUserId: string;
  paymentRef?: string;
}): Promise<void> {
  const redemption = await prisma.referralRedemption.findUnique({
    where: { inviteeUserId: params.inviteeUserId },
  });
  if (!redemption) return;
  if (redemption.status !== "CONFIRMED") {
    await prisma.referralRedemption.update({
      where: { id: redemption.id },
      data: { status: "CANCELED" },
    });
    return;
  }

  await revokeCredits({
    userId: redemption.inviterUserId,
    bucket: "REFERRAL",
    amount: REFERRAL_INVITER_BONUS,
    idempotencyKey: `referral-revoke:${redemption.id}:INVITER`,
    paymentRef: params.paymentRef,
    note: "Revoca bonus referral invitante (rimborso/chargeback)",
  });
  await revokeCredits({
    userId: redemption.inviteeUserId,
    bucket: "REFERRAL",
    amount: REFERRAL_INVITEE_BONUS,
    idempotencyKey: `referral-revoke:${redemption.id}:INVITEE`,
    paymentRef: params.paymentRef,
    note: "Revoca bonus referral invitato (rimborso/chargeback)",
  });
  await prisma.referralRedemption.update({
    where: { id: redemption.id },
    data: { status: "CANCELED" },
  });
}

export async function getReferralDashboard(userId: string) {
  const profile = await ensureReferralProfile(userId);
  const [pending, confirmed, canceled, bonusEarned] = await Promise.all([
    prisma.referralRedemption.count({
      where: { inviterUserId: userId, status: "PENDING" },
    }),
    prisma.referralRedemption.count({
      where: { inviterUserId: userId, status: "CONFIRMED" },
    }),
    prisma.referralRedemption.count({
      where: { inviterUserId: userId, status: { in: ["CANCELED", "INVALID"] } },
    }),
    prisma.creditTransaction.aggregate({
      where: { userId, type: "REFERRAL_INVITER" },
      _sum: { amount: true },
    }),
  ]);
  const recent = await prisma.referralRedemption.findMany({
    where: { inviterUserId: userId },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      status: true,
      createdAt: true,
      rewardedAt: true,
    },
  });
  return {
    code: profile.code,
    suspended: profile.suspended,
    invitedTotal: pending + confirmed + canceled,
    confirmed,
    pending,
    canceled,
    bonusEarned: bonusEarned._sum.amount ?? 0,
    recent,
  };
}
