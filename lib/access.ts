import { prisma } from "./prisma";
import { isDevAuthBypass } from "./require-user";
import { visibleCasesWhere } from "./access-queries";
import {
  assertCanAccessBundle,
  gateToResponse,
  hasActiveSubscription,
} from "./billing/access-gate";
import { getUserBillingProfile } from "./billing/user-billing";
import { isRegisteredCaseId } from "@/lib/data/cases/registry";

export { attachableCasesWhere, visibleCasesWhere } from "./access-queries";

export async function userCanPlayCase(userId: string, caseId: string): Promise<boolean> {
  if (isDevAuthBypass()) return true;
  // Gold-standard Prassi registry cases are always playable for authenticated users.
  if (isRegisteredCaseId(caseId)) return true;

  const n = await prisma.clinicalCase.count({
    where: { id: caseId, ...visibleCasesWhere(userId) },
  });
  return n > 0;
}

/** Returns a billing-aware HTTP response when case access is denied; null if allowed. */
export async function assertUserCanPlayCase(userId: string, caseId: string): Promise<Response | null> {
  if (isDevAuthBypass()) return null;

  if (isRegisteredCaseId(caseId)) {
    return null;
  }

  const clinicalCase = await prisma.clinicalCase.findFirst({
    where: { id: caseId, ...visibleCasesWhere(userId) },
    select: { id: true, caseBundleId: true },
  });

  if (!clinicalCase) {
    return new Response(
      JSON.stringify({
        error: "Questo caso non è disponibile o non è più attivo.",
        code: "CASE_NOT_VISIBLE",
      }),
      {
        status: 403,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  if (!clinicalCase.caseBundleId) return null;

  const profile = await getUserBillingProfile(userId);
  if (!profile) {
    return new Response(
      JSON.stringify({
        error: "Profilo utente non trovato.",
        code: "USER_NOT_FOUND",
      }),
      {
        status: 403,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  const bundleGate = assertCanAccessBundle(profile, clinicalCase.caseBundleId);
  if (!bundleGate.allowed) {
    return gateToResponse(bundleGate);
  }

  return null;
}

export { hasActiveSubscription };

export async function userCanManageCase(userId: string, caseId: string): Promise<boolean> {
  const n = await prisma.clinicalCase.count({
    where: { id: caseId, createdById: userId },
  });
  return n > 0;
}

export async function verifyLiveSessionOwner(
  sessionId: string,
  userId: string,
): Promise<boolean> {
  if (isDevAuthBypass()) return true;

  const row = await prisma.caseSession.findUnique({
    where: { id: sessionId },
    select: { userId: true },
  });
  return row?.userId === userId;
}
