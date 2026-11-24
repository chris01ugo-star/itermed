import "server-only";
import { prisma } from "@/lib/prisma";
import {
  consumeSimulationCredit,
  CREDITS_EXHAUSTED_CODE,
  CREDITS_EXHAUSTED_MESSAGE,
  refundSimulationCredit,
} from "@/lib/billing/credit-ledger";
import { shouldConsumeCredits } from "@/lib/billing/credit-policy";
import { isSessionTooShort } from "@/lib/billing/short-session";
import type { UserBillingProfile } from "@/lib/billing/user-billing";
import { sanitizeLiveSessionId } from "@/lib/simulator/session-id";

export async function findResumableCaseSession(
  userId: string,
  caseId: string,
): Promise<{ id: string } | null> {
  const sessions = await prisma.caseSession.findMany({
    where: { userId, caseId },
    orderBy: { updatedAt: "desc" },
    take: 8,
    select: { id: true, createdAt: true },
  });

  for (const session of sessions) {
    const report = await prisma.sessionReport.findFirst({
      where: {
        userId,
        caseId,
        OR: [
          { rawTrace: { path: ["jobQueue", "liveSessionId"], equals: session.id } },
          { createdAt: { gte: session.createdAt } },
        ],
      },
      select: { id: true },
    });
    if (!report) return { id: session.id };
  }
  return null;
}

export async function consumeCreditForNewSession(params: {
  profile: UserBillingProfile;
  sessionId: string;
}): Promise<{ ok: true } | { ok: false; code: string; message: string; status: number }> {
  if (!shouldConsumeCredits(params.profile)) {
    return { ok: true };
  }
  const result = await consumeSimulationCredit({
    userId: params.profile.id,
    sessionId: params.sessionId,
  });
  if (!result.ok) {
    return {
      ok: false,
      code: CREDITS_EXHAUSTED_CODE,
      message: CREDITS_EXHAUSTED_MESSAGE,
      status: 402,
    };
  }
  return { ok: true };
}

export async function rollbackNewSession(params: {
  profile: UserBillingProfile;
  sessionId: string;
  reason: string;
}): Promise<void> {
  if (shouldConsumeCredits(params.profile)) {
    await refundSimulationCredit({
      userId: params.profile.id,
      sessionId: params.sessionId,
      reason: params.reason,
    });
  }
  await prisma.caseSession.delete({ where: { id: params.sessionId } }).catch(() => undefined);
}

/**
 * Bounce under 30s: refund the simulation credit and drop the CaseSession
 * so quota, playStatus and dismiss-0 reports do not treat it as used.
 * Completing (or queuing) a report still counts even if the wall clock is short.
 */
export async function releaseShortLivedSession(params: {
  userId: string;
  sessionId: string;
  now?: Date;
}): Promise<{ released: boolean; reason: string }> {
  const sessionId = sanitizeLiveSessionId(params.sessionId);
  if (!sessionId) {
    return { released: false, reason: "invalid" };
  }

  const session = await prisma.caseSession.findUnique({
    where: { id: sessionId },
    select: { id: true, userId: true, caseId: true, createdAt: true },
  });
  if (!session || session.userId !== params.userId) {
    return { released: false, reason: "not_found" };
  }

  const now = params.now ?? new Date();
  if (!isSessionTooShort(session.createdAt, now)) {
    return { released: false, reason: "elapsed" };
  }

  const linkedReport = await prisma.sessionReport.findFirst({
    where: {
      userId: params.userId,
      caseId: session.caseId,
      OR: [
        { rawTrace: { path: ["jobQueue", "liveSessionId"], equals: session.id } },
        { rawTrace: { path: ["liveSessionId"], equals: session.id } },
        { createdAt: { gte: session.createdAt } },
      ],
    },
    select: { id: true },
  });
  if (linkedReport) {
    return { released: false, reason: "reported" };
  }

  await refundSimulationCredit({
    userId: params.userId,
    sessionId: session.id,
    reason: "Sessione sotto i 30 secondi: credito non conteggiato",
  });
  await prisma.caseSession.delete({ where: { id: session.id } }).catch(() => undefined);
  return { released: true, reason: "short" };
}
