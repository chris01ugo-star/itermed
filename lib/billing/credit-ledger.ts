import "server-only";
import type { CreditBucket, CreditTxnType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  applyMonthlyGrant,
  clampMonthlyToCap,
  EXTRA_CREDIT_PACK,
  pickConsumeBucket,
  saasPlanDefinition,
  totalAvailableCredits,
  type SaasPlanId,
} from "@/lib/billing/plans";
import { CREDITS_EXHAUSTED_MESSAGE } from "@/lib/billing/credit-policy";
import { createLogger } from "@/lib/logger";

const log = createLogger("credit-ledger");

type Tx = Prisma.TransactionClient;

export type CreditBalances = {
  monthlyBalance: number;
  purchasedBalance: number;
  referralBalance: number;
  monthlyGrantCap: number;
  total: number;
};

export {
  CREDITS_EXHAUSTED_CODE,
  CREDITS_EXHAUSTED_MESSAGE,
  SUBSCRIPTION_REQUIRED_CODE,
  SUBSCRIPTION_REQUIRED_MESSAGE,
} from "@/lib/billing/credit-policy";

function bucketColumn(bucket: CreditBucket): "monthlyBalance" | "purchasedBalance" | "referralBalance" {
  if (bucket === "MONTHLY") return "monthlyBalance";
  if (bucket === "PURCHASED") return "purchasedBalance";
  return "referralBalance";
}

async function lockWallet(tx: Tx, userId: string) {
  await tx.$queryRaw`SELECT "userId" FROM "CreditWallet" WHERE "userId" = ${userId} FOR UPDATE`;
  return tx.creditWallet.findUnique({ where: { userId } });
}

export async function ensureCreditWallet(
  tx: Tx,
  userId: string,
  monthlyGrantCap = 0,
): Promise<NonNullable<Awaited<ReturnType<typeof lockWallet>>>> {
  const existing = await tx.creditWallet.findUnique({ where: { userId } });
  if (existing) return existing;
  return tx.creditWallet.create({
    data: {
      userId,
      monthlyGrantCap,
      updatedAt: new Date(),
    },
  });
}

async function recordTxn(
  tx: Tx,
  params: {
    userId: string;
    type: CreditTxnType;
    bucket: CreditBucket;
    amount: number;
    idempotencyKey: string;
    sourceType?: string;
    sourceId?: string;
    paymentRef?: string;
    sessionId?: string;
    note?: string;
    actorUserId?: string;
  },
): Promise<{ created: boolean }> {
  try {
    await tx.creditTransaction.create({
      data: {
        userId: params.userId,
        type: params.type,
        bucket: params.bucket,
        amount: params.amount,
        idempotencyKey: params.idempotencyKey,
        sourceType: params.sourceType,
        sourceId: params.sourceId,
        paymentRef: params.paymentRef,
        sessionId: params.sessionId,
        note: params.note,
        actorUserId: params.actorUserId,
      },
    });
    return { created: true };
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code?: unknown }).code)
        : "";
    if (code === "P2002") return { created: false };
    throw error;
  }
}

export async function getCreditBalances(userId: string): Promise<CreditBalances> {
  const wallet = await prisma.creditWallet.findUnique({ where: { userId } });
  const monthlyBalance = wallet?.monthlyBalance ?? 0;
  const purchasedBalance = wallet?.purchasedBalance ?? 0;
  const referralBalance = wallet?.referralBalance ?? 0;
  return {
    monthlyBalance,
    purchasedBalance,
    referralBalance,
    monthlyGrantCap: wallet?.monthlyGrantCap ?? 0,
    total: totalAvailableCredits({ monthlyBalance, purchasedBalance, referralBalance }),
  };
}

/**
 * Credits are committed only after the unique idempotency key is accepted.
 * Duplicate Stripe events / retries grant 0 extra credits.
 */
export async function grantMonthlyCredits(params: {
  userId: string;
  plan: SaasPlanId;
  periodStart: Date;
  paymentRef?: string;
  sourceId?: string;
}): Promise<{ granted: number; skipped: boolean }> {
  const def = saasPlanDefinition(params.plan);
  if (!def) return { granted: 0, skipped: true };
  const periodKey = params.periodStart.toISOString().slice(0, 10);
  const idempotencyKey = `monthly:${params.userId}:${periodKey}:${def.id}`;

  return prisma.$transaction(async (tx) => {
    await ensureCreditWallet(tx, params.userId, def.monthlyCap);
    const already = await tx.creditTransaction.findUnique({
      where: { idempotencyKey },
    });
    if (already) return { granted: 0, skipped: true };
    const inserted = await recordTxn(tx, {
      userId: params.userId,
      type: "MONTHLY_GRANT",
      bucket: "MONTHLY",
      amount: def.monthlyCredits,
      idempotencyKey,
      sourceType: "subscription_period",
      sourceId: params.sourceId,
      paymentRef: params.paymentRef,
      note: `Accredito mensile ${def.displayName}`,
    });
    if (!inserted.created) return { granted: 0, skipped: true };

    const wallet = await lockWallet(tx, params.userId);
    if (!wallet) return { granted: 0, skipped: true };
    const { nextMonthly, granted } = applyMonthlyGrant(
      wallet.monthlyBalance,
      def.monthlyCredits,
      def.monthlyCap,
    );
    await tx.creditWallet.update({
      where: { userId: params.userId },
      data: {
        monthlyBalance: nextMonthly,
        monthlyGrantCap: def.monthlyCap,
        currentPeriodStart: params.periodStart,
      },
    });
    if (granted !== def.monthlyCredits) {
      log.info("Monthly grant clamped to cap", {
        userId: params.userId,
        plan: def.id,
        granted,
        cap: def.monthlyCap,
      });
    }
    return { granted, skipped: false };
  });
}

export async function grantPurchasedPack(params: {
  userId: string;
  paymentRef: string;
  sourceId?: string;
}): Promise<{ granted: number; skipped: boolean }> {
  const idempotencyKey = `extra:${params.paymentRef}`;
  return prisma.$transaction(async (tx) => {
    await ensureCreditWallet(tx, params.userId);
    const inserted = await recordTxn(tx, {
      userId: params.userId,
      type: "EXTRA_PACK",
      bucket: "PURCHASED",
      amount: EXTRA_CREDIT_PACK.credits,
      idempotencyKey,
      sourceType: "checkout",
      sourceId: params.sourceId ?? params.paymentRef,
      paymentRef: params.paymentRef,
      note: "Pacchetto 5 simulazioni extra",
    });
    if (!inserted.created) return { granted: 0, skipped: true };
    await lockWallet(tx, params.userId);
    await tx.creditWallet.update({
      where: { userId: params.userId },
      data: { purchasedBalance: { increment: EXTRA_CREDIT_PACK.credits } },
    });
    return { granted: EXTRA_CREDIT_PACK.credits, skipped: false };
  });
}

export async function grantReferralBonus(params: {
  userId: string;
  role: "INVITER" | "INVITEE";
  redemptionId: string;
  amount: number;
}): Promise<{ granted: number; skipped: boolean }> {
  const type: CreditTxnType =
    params.role === "INVITER" ? "REFERRAL_INVITER" : "REFERRAL_INVITEE";
  const idempotencyKey = `referral:${params.redemptionId}:${params.role}`;
  return prisma.$transaction(async (tx) => {
    await ensureCreditWallet(tx, params.userId);
    const inserted = await recordTxn(tx, {
      userId: params.userId,
      type,
      bucket: "REFERRAL",
      amount: params.amount,
      idempotencyKey,
      sourceType: "referral",
      sourceId: params.redemptionId,
      note:
        params.role === "INVITER"
          ? "Bonus referral invitante"
          : "Bonus referral invitato",
    });
    if (!inserted.created) return { granted: 0, skipped: true };
    await lockWallet(tx, params.userId);
    await tx.creditWallet.update({
      where: { userId: params.userId },
      data: { referralBalance: { increment: params.amount } },
    });
    return { granted: params.amount, skipped: false };
  });
}

export async function applyPlanChangeCap(params: {
  userId: string;
  plan: SaasPlanId;
  sourceId?: string;
}): Promise<void> {
  const def = saasPlanDefinition(params.plan);
  if (!def) return;
  const idempotencyKey = `plan-change:${params.userId}:${params.plan}:${params.sourceId ?? "none"}`;
  await prisma.$transaction(async (tx) => {
    await ensureCreditWallet(tx, params.userId, def.monthlyCap);
    const wallet = await lockWallet(tx, params.userId);
    if (!wallet) return;
    const nextMonthly = clampMonthlyToCap(wallet.monthlyBalance, def.monthlyCap);
    const delta = nextMonthly - wallet.monthlyBalance;
    if (delta === 0 && wallet.monthlyGrantCap === def.monthlyCap) {
      await tx.creditWallet.update({
        where: { userId: params.userId },
        data: { monthlyGrantCap: def.monthlyCap },
      });
      return;
    }
    const inserted = await recordTxn(tx, {
      userId: params.userId,
      type: "PLAN_CHANGE",
      bucket: "MONTHLY",
      amount: delta,
      idempotencyKey,
      sourceType: "plan_change",
      sourceId: params.sourceId,
      note: `Adeguamento tetto mensile ${def.displayName}`,
    });
    if (!inserted.created) return;
    await tx.creditWallet.update({
      where: { userId: params.userId },
      data: {
        monthlyBalance: nextMonthly,
        monthlyGrantCap: def.monthlyCap,
      },
    });
  });
}

export type ConsumeCreditResult =
  | { ok: true; bucket: CreditBucket; txnId: string }
  | { ok: false; code: "INSUFFICIENT"; message: string };

/**
 * Atomically consumes one simulation credit (FOR UPDATE).
 * Two concurrent starts with one remaining credit: only one succeeds.
 */
export async function consumeSimulationCredit(params: {
  userId: string;
  sessionId: string;
}): Promise<ConsumeCreditResult> {
  const idempotencyKey = `use:${params.sessionId}`;
  return prisma.$transaction(async (tx) => {
    await ensureCreditWallet(tx, params.userId);
    const existing = await tx.creditTransaction.findUnique({
      where: { idempotencyKey },
    });
    if (existing && existing.type === "SIMULATION_USE") {
      return { ok: true as const, bucket: existing.bucket, txnId: existing.id };
    }

    const wallet = await lockWallet(tx, params.userId);
    if (!wallet) {
      return {
        ok: false as const,
        code: "INSUFFICIENT" as const,
        message: CREDITS_EXHAUSTED_MESSAGE,
      };
    }
    const bucket = pickConsumeBucket(wallet);
    if (!bucket) {
      return {
        ok: false as const,
        code: "INSUFFICIENT" as const,
        message: CREDITS_EXHAUSTED_MESSAGE,
      };
    }
    const column = bucketColumn(bucket);
    await tx.creditWallet.update({
      where: { userId: params.userId },
      data: { [column]: { decrement: 1 } },
    });
    const txn = await tx.creditTransaction.create({
      data: {
        userId: params.userId,
        type: "SIMULATION_USE",
        bucket,
        amount: -1,
        idempotencyKey,
        sourceType: "simulation",
        sourceId: params.sessionId,
        sessionId: params.sessionId,
        note: "Utilizzo simulazione clinica",
      },
    });
    return { ok: true as const, bucket, txnId: txn.id };
  });
}

/** Restore a credit after a failed session create (same sessionId, same idempotency). */
export async function refundSimulationCredit(params: {
  userId: string;
  sessionId: string;
  reason: string;
}): Promise<void> {
  const useKey = `use:${params.sessionId}`;
  const refundKey = `refund-use:${params.sessionId}`;
  await prisma.$transaction(async (tx) => {
    const useTxn = await tx.creditTransaction.findUnique({
      where: { idempotencyKey: useKey },
    });
    if (!useTxn || useTxn.type !== "SIMULATION_USE") return;
    const inserted = await recordTxn(tx, {
      userId: params.userId,
      type: "REFUND_REVOKE",
      bucket: useTxn.bucket,
      amount: 1,
      idempotencyKey: refundKey,
      sourceType: "simulation_rollback",
      sourceId: params.sessionId,
      sessionId: params.sessionId,
      note: params.reason,
    });
    if (!inserted.created) return;
    await lockWallet(tx, params.userId);
    const column = bucketColumn(useTxn.bucket);
    await tx.creditWallet.update({
      where: { userId: params.userId },
      data: { [column]: { increment: 1 } },
    });
  });
}

/**
 * Revoke unused credits after a refund/chargeback.
 * Never drives a bucket below 0 — remaining debt is recorded on the ledger only.
 */
export async function revokeCredits(params: {
  userId: string;
  bucket: CreditBucket;
  amount: number;
  idempotencyKey: string;
  paymentRef?: string;
  note: string;
}): Promise<{ revoked: number }> {
  const amount = Math.max(0, Math.floor(params.amount));
  if (amount === 0) return { revoked: 0 };
  return prisma.$transaction(async (tx) => {
    await ensureCreditWallet(tx, params.userId);
    const inserted = await recordTxn(tx, {
      userId: params.userId,
      type: "REFUND_REVOKE",
      bucket: params.bucket,
      amount: -amount,
      idempotencyKey: params.idempotencyKey,
      sourceType: "refund",
      paymentRef: params.paymentRef,
      note: params.note,
    });
    if (!inserted.created) return { revoked: 0 };
    const wallet = await lockWallet(tx, params.userId);
    if (!wallet) return { revoked: 0 };
    const column = bucketColumn(params.bucket);
    const available = wallet[column];
    const revoked = Math.min(available, amount);
    await tx.creditWallet.update({
      where: { userId: params.userId },
      data: { [column]: available - revoked },
    });
    return { revoked };
  });
}

export async function adminAdjustCredits(params: {
  actorUserId: string;
  targetUserId: string;
  bucket: CreditBucket;
  amount: number;
  reason: string;
}): Promise<CreditBalances> {
  const amount = Math.trunc(params.amount);
  if (amount === 0) return getCreditBalances(params.targetUserId);
  const idempotencyKey = `admin:${params.targetUserId}:${Date.now()}:${crypto.randomUUID()}`;
  await prisma.$transaction(async (tx) => {
    await ensureCreditWallet(tx, params.targetUserId);
    await recordTxn(tx, {
      userId: params.targetUserId,
      type: "ADMIN_ADJUST",
      bucket: params.bucket,
      amount,
      idempotencyKey,
      sourceType: "admin",
      actorUserId: params.actorUserId,
      note: params.reason,
    });
    await lockWallet(tx, params.targetUserId);
    const column = bucketColumn(params.bucket);
    const wallet = await tx.creditWallet.findUnique({ where: { userId: params.targetUserId } });
    const next = Math.max(0, (wallet?.[column] ?? 0) + amount);
    await tx.creditWallet.update({
      where: { userId: params.targetUserId },
      data: { [column]: next },
    });
    await tx.creditAdminAudit.create({
      data: {
        actorUserId: params.actorUserId,
        targetUserId: params.targetUserId,
        amount,
        bucket: params.bucket,
        reason: params.reason,
      },
    });
  });
  return getCreditBalances(params.targetUserId);
}
