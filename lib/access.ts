import { prisma } from "./prisma";
import { isDevAuthBypass } from "./require-user";
import { visibleCasesWhere } from "./access-queries";
import {
  assertCanAccessBundle,
  gateToResponse,
  hasActiveSubscription,
} from "./billing/access-gate";
import { getUserBillingProfile } from "./billing/user-billing";
import { isRegisteredCaseId, normalizeCaseLookupKey } from "@/lib/data/cases/registry";
import { isOfflineSessionId, sanitizeLiveSessionId } from "@/lib/simulator/session-id";

export { attachableCasesWhere, visibleCasesWhere } from "./access-queries";

export async function userCanPlayCase(userId: string, caseId: string): Promise<boolean> {
  if (isDevAuthBypass()) return true;
  const normalized = normalizeCaseLookupKey(caseId);
  // Gold-standard Prassi registry cases are always playable for authenticated users.
  if (isRegisteredCaseId(caseId) || isRegisteredCaseId(normalized)) return true;

  const ids = [...new Set([caseId, normalized].filter(Boolean))];
  const n = await prisma.clinicalCase.count({
    where: {
      id: { in: ids },
      ...visibleCasesWhere(userId),
    },
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
  // Offline / registry tokens are not Prisma CaseSession rows.
  if (isOfflineSessionId(sessionId)) return false;

  const row = await prisma.caseSession.findUnique({
    where: { id: sessionId },
    select: { userId: true },
  });
  return row?.userId === userId;
}

export type SimulationAccessResult =
  | { ok: true; liveSessionId?: string; caseId?: string }
  | { ok: false; status: 400 | 403; error: string; code: string };

/**
 * Authorize examine / report / chat against an optional live session and/or case.
 * - `registry_*` offline tokens are ignored (not treated as owned sessions).
 * - Stale session ids fall back to case-level access when the case is playable.
 */
export async function authorizeSimulationAction(params: {
  userId: string;
  sessionId?: string | null;
  caseId?: string | null;
}): Promise<SimulationAccessResult> {
  if (isDevAuthBypass()) {
    return {
      ok: true,
      liveSessionId: sanitizeLiveSessionId(params.sessionId),
      caseId: params.caseId?.trim() || undefined,
    };
  }

  const liveSessionId = sanitizeLiveSessionId(params.sessionId);
  const caseIdRaw = params.caseId?.trim() || undefined;
  const caseId = caseIdRaw ? normalizeCaseLookupKey(caseIdRaw) : undefined;

  if (liveSessionId) {
    const owns = await verifyLiveSessionOwner(liveSessionId, params.userId);
    if (owns) {
      return { ok: true, liveSessionId, caseId: caseIdRaw || caseId };
    }
    // Stale / foreign session — do not hard-block if the case itself is playable.
    if (caseIdRaw && (await userCanPlayCase(params.userId, caseIdRaw))) {
      return { ok: true, caseId: caseIdRaw };
    }
    return {
      ok: false,
      status: 403,
      error: "Forbidden",
      code: "FORBIDDEN_SESSION",
    };
  }

  if (caseIdRaw) {
    const allowed = await userCanPlayCase(params.userId, caseIdRaw);
    if (!allowed) {
      return { ok: false, status: 403, error: "Forbidden", code: "FORBIDDEN_CASE" };
    }
    return { ok: true, caseId: caseIdRaw };
  }

  return {
    ok: false,
    status: 400,
    error: "sessionId or caseId required",
    code: "SESSION_OR_CASE_REQUIRED",
  };
}
