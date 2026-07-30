import "server-only";
import { createLogger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { getStripeClient, isStripeConfigured } from "@/lib/billing/stripe-client";

const log = createLogger("account-gdpr");

const SYSTEM_ORPHAN_EMAIL = "system-orphan@itermed.local";

/** Reassign authored clinical cases so User row can be hard-deleted (FK). */
async function reassignCreatedCases(userId: string): Promise<number> {
  const caseCount = await prisma.clinicalCase.count({ where: { createdById: userId } });
  if (caseCount === 0) return 0;

  let orphanOwnerId: string | null = null;
  const otherAdmin = await prisma.user.findFirst({
    where: { role: "ADMIN", id: { not: userId } },
    select: { id: true },
  });
  if (otherAdmin) {
    orphanOwnerId = otherAdmin.id;
  } else {
    const system = await prisma.user.upsert({
      where: { email: SYSTEM_ORPHAN_EMAIL },
      create: {
        email: SYSTEM_ORPHAN_EMAIL,
        name: "System (orphan cases)",
        role: "ADMIN",
        leaderboardOptIn: false,
      },
      update: {},
      select: { id: true },
    });
    orphanOwnerId = system.id;
  }

  const result = await prisma.clinicalCase.updateMany({
    where: { createdById: userId },
    data: { createdById: orphanOwnerId },
  });
  return result.count;
}

/** Cancel Stripe subscription if present; never throws to the caller. */
export async function cancelStripeForUser(params: {
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
}): Promise<void> {
  if (!isStripeConfigured()) return;
  if (!params.stripeCustomerId && !params.stripeSubscriptionId) return;

  try {
    const stripe = getStripeClient();
    if (params.stripeSubscriptionId) {
      try {
        await stripe.subscriptions.cancel(params.stripeSubscriptionId);
      } catch (error) {
        // Fallback: cancel all active/trialing subs on the customer.
        log.warn("Stripe subscription.cancel failed; listing customer subscriptions", {
          error,
          stripeSubscriptionId: params.stripeSubscriptionId,
        });
        if (params.stripeCustomerId) {
          const subs = await stripe.subscriptions.list({
            customer: params.stripeCustomerId,
            status: "all",
            limit: 20,
          });
          for (const sub of subs.data) {
            if (sub.status === "canceled" || sub.status === "incomplete_expired") continue;
            await stripe.subscriptions.cancel(sub.id).catch((cancelError) => {
              log.warn("Stripe subscription cancel retry failed", {
                error: cancelError,
                subscriptionId: sub.id,
              });
            });
          }
        }
      }
    } else if (params.stripeCustomerId) {
      const subs = await stripe.subscriptions.list({
        customer: params.stripeCustomerId,
        status: "all",
        limit: 20,
      });
      for (const sub of subs.data) {
        if (sub.status === "canceled" || sub.status === "incomplete_expired") continue;
        await stripe.subscriptions.cancel(sub.id).catch((cancelError) => {
          log.warn("Stripe subscription cancel failed", {
            error: cancelError,
            subscriptionId: sub.id,
          });
        });
      }
    }
  } catch (error) {
    log.error("Stripe cancellation during account erasure failed", { error });
  }
}

export async function exportUserData(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      planType: true,
      subscriptionStatus: true,
      stripeCustomerId: true,
      stripeSubscriptionId: true,
      freeTrialUsageCount: true,
      purchasedBundleIds: true,
      leaderboardOptIn: true,
      leaderboardNameType: true,
      nickname: true,
      termsAcceptedAt: true,
      privacyAcceptedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) return null;

  const [liveSessions, sessions] = await Promise.all([
    prisma.caseSession.findMany({
      where: { userId },
      include: {
        milestones: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.sessionReport.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    gdprArticle: "Art. 20 GDPR — data portability",
    profile: user,
    liveSessions,
    sessions,
    note:
      "passwordHash is never included. chatHistory is embedded in liveSessions when present. SessionReport.rawTrace may contain evaluation telemetry.",
  };
}

/**
 * Art. 17 erasure: cancel billing, purge simulation PII, reassign authored cases, delete User.
 */
export async function eraseUserAccount(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      stripeCustomerId: true,
      stripeSubscriptionId: true,
    },
  });
  if (!user) {
    throw new Error("USER_NOT_FOUND");
  }

  await cancelStripeForUser({
    stripeCustomerId: user.stripeCustomerId,
    stripeSubscriptionId: user.stripeSubscriptionId,
  });

  const reassignedCases = await reassignCreatedCases(userId);

  await prisma.$transaction(async (tx) => {
    // Milestones cascade from CaseSession; delete sessions first.
    const deletedSessions = await tx.caseSession.deleteMany({ where: { userId } });
    const deletedReports = await tx.sessionReport.deleteMany({ where: { userId } });
    await tx.user.delete({ where: { id: userId } });

    log.info("user.account.erased", {
      event: "user.account.erased",
      userId,
      email: user.email,
      deletedLiveSessions: deletedSessions.count,
      deletedSessionReports: deletedReports.count,
      reassignedCases,
    });
  });
}

/** NextAuth cookie names to clear after account deletion (JWT strategy). */
export const NEXTAUTH_COOKIE_NAMES = [
  "next-auth.session-token",
  "__Secure-next-auth.session-token",
  "next-auth.csrf-token",
  "__Host-next-auth.csrf-token",
  "next-auth.callback-url",
  "__Secure-next-auth.callback-url",
] as const;
