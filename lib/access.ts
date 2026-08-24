import { prisma } from "./prisma";
import { isDevAuthBypass } from "./require-user";
import { visibleCasesWhere } from "./access-queries";
import {
  assertCanAccessBundle,
  gateToResponse,
  hasActiveSubscription,
} from "./billing/access-gate";
import { getUserBillingProfile } from "./billing/user-billing";
import { getCaseById } from "@/lib/data/cases/registry";
import {
  isRegisteredCaseId,
  knowledgeBaseIdCandidates,
  normalizeCaseLookupKey,
} from "@/lib/data/cases/registry-store";
import { isOfflineSessionId, sanitizeLiveSessionId } from "@/lib/simulator/session-id";

export { attachableCasesWhere, visibleCasesWhere } from "./access-queries";

export async function userCanPlayCase(userId: string, caseId: string): Promise<boolean> {
  if (isDevAuthBypass()) return true;
  const normalized = normalizeCaseLookupKey(caseId);
  // Gold-standard Prassi registry cases are always playable for authenticated users.
  if (isRegisteredCaseId(caseId) || isRegisteredCaseId(normalized)) return true;
  if (await getCaseById(caseId)) return true;

  try {
    const ids = knowledgeBaseIdCandidates(caseId);
    if (ids.length === 0) return false;
    const n = await prisma.clinicalCase.count({
      where: {
        id: { in: ids },
        ...visibleCasesWhere(userId),
      },
    });
    return n > 0;
  } catch (err) {
    console.error("[userCanPlayCase] prisma failed", caseId, err);
    // Fail-open for authored registry cases if DB is unreachable.
    return isRegisteredCaseId(caseId) || isRegisteredCaseId(normalized);
  }
}

/** Returns a billing-aware HTTP response when case access is denied; null if allowed. */
export async function assertUserCanPlayCase(userId: string, caseId: string): Promise<Response | null> {
  if (isDevAuthBypass()) return null;

  if (isRegisteredCaseId(caseId) || (await getCaseById(caseId))) {
    return null;
  }

  const clinicalCase = await prisma.clinicalCase.findFirst({
    where: { id: { in: knowledgeBaseIdCandidates(caseId) }, ...visibleCasesWhere(userId) },
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

  try {
    const row = await prisma.caseSession.findUnique({
      where: { id: sessionId },
      select: { userId: true },
    });
    return row?.userId === userId;
  } catch (err) {
    console.error("[verifyLiveSessionOwner] prisma failed", err);
    return false;
  }
}

function caseIdsReferToSameCase(left: string, right: string): boolean {
  if (left === right) return true;
  const a = normalizeCaseLookupKey(left);
  const b = normalizeCaseLookupKey(right);
  if (a && b && a === b) return true;
  const leftIds = new Set(knowledgeBaseIdCandidates(left));
  const rightIds = new Set(knowledgeBaseIdCandidates(right));
  for (const id of leftIds) {
    if (rightIds.has(id)) return true;
  }
  return leftIds.has(right) || rightIds.has(left);
}

/**
 * Strict IDOR guard: the caller must own the live Prisma CaseSession.
 * Offline/registry tokens and missing session ids are denied.
 */
export async function authorizeOwnedLiveSession(params: {
  userId: string;
  sessionId?: string | null;
  expectedCaseId?: string | null;
}): Promise<
  | { ok: true; liveSessionId: string; caseId: string }
  | { ok: false; status: 400 | 403; error: string; code: string }
> {
  const raw = params.sessionId?.trim() ?? "";
  if (!raw) {
    return { ok: false, status: 400, error: "sessionId required", code: "SESSION_REQUIRED" };
  }

  const liveSessionId = sanitizeLiveSessionId(raw);
  if (!liveSessionId) {
    return { ok: false, status: 403, error: "Forbidden", code: "FORBIDDEN_SESSION" };
  }

  try {
    const row = await prisma.caseSession.findUnique({
      where: { id: liveSessionId },
      select: { userId: true, caseId: true },
    });
    if (!row || row.userId !== params.userId) {
      return { ok: false, status: 403, error: "Forbidden", code: "FORBIDDEN_SESSION" };
    }
    const expected = params.expectedCaseId?.trim();
    if (expected && !caseIdsReferToSameCase(expected, row.caseId)) {
      return { ok: false, status: 403, error: "Forbidden", code: "FORBIDDEN_CASE" };
    }
    return { ok: true, liveSessionId, caseId: row.caseId };
  } catch (err) {
    console.error("[authorizeOwnedLiveSession] prisma failed", err);
    return { ok: false, status: 403, error: "Forbidden", code: "FORBIDDEN_SESSION" };
  }
}

export type SimulationAccessResult =
  | { ok: true; liveSessionId?: string; caseId?: string }
  | { ok: false; status: 400 | 403; error: string; code: string };

/**
 * Authorize examine / report / chat against an optional live session and/or case.
 * - `registry_*` offline tokens are never treated as owned sessions.
 * - A foreign or stale sessionId is always 403 (no case-level fallback — IDOR).
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

  if (params.sessionId?.trim() && !liveSessionId) {
    return {
      ok: false,
      status: 403,
      error: "Forbidden",
      code: "FORBIDDEN_SESSION",
    };
  }

  if (liveSessionId) {
    const owned = await authorizeOwnedLiveSession({
      userId: params.userId,
      sessionId: liveSessionId,
      expectedCaseId: caseIdRaw,
    });
    if (!owned.ok) return owned;
    return { ok: true, liveSessionId: owned.liveSessionId, caseId: owned.caseId };
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
