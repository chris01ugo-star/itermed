import "server-only";
import { prisma } from "@/lib/prisma";
import {
  consumeSimulationCredit,
  CREDITS_EXHAUSTED_CODE,
  CREDITS_EXHAUSTED_MESSAGE,
  refundSimulationCredit,
} from "@/lib/billing/credit-ledger";
import { shouldConsumeCredits } from "@/lib/billing/credit-policy";
import type { UserBillingProfile } from "@/lib/billing/user-billing";

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
