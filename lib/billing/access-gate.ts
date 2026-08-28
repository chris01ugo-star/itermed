import "server-only";
import {
  ACTIVE_SUBSCRIPTION_STATUSES,
  DAILY_SIMULATION_LIMIT,
  isSubscriptionPlan,
} from "@/lib/billing/plans";
import type { UserBillingProfile } from "@/lib/billing/user-billing";
import { canHonorDailyLimitBypass } from "@/lib/security/dev-only-gates";

/** Patient chat always uses gpt-4o-mini. gpt-4o is reserved for evaluation/RAG. */
export type ChatModelId = "gpt-4o-mini";

export type GateResult =
  | { allowed: true }
  | { allowed: false; code: string; message: string; status: number };

/**
 * Default clinical anamnesis cap: 35 user turns ≈ ~70 total chat messages.
 * Complex cases must not be starved mid-history-taking.
 */
export const DEFAULT_CLINICAL_USER_MESSAGE_LIMIT = 35;

/** Absolute bounds for per-case overrides (`caseInput.maxUserMessages`). */
export const MIN_CLINICAL_USER_MESSAGE_LIMIT = 10;
export const MAX_CLINICAL_USER_MESSAGE_LIMIT = 80;

/** Professional soft-stop when the anamnesis budget is exhausted. */
export const ANAMNESIS_COMPLETE_MESSAGE =
  "Anamnesi completata. Hai raccolto tutti gli elementi anamnestici necessari per questo caso: procedi ora con gli esami di laboratorio/strumentali o con la diagnosi finale.";

function isAdmin(profile: UserBillingProfile): boolean {
  return profile.role === "ADMIN";
}

/** Beta / early-access plans must never be blocked from running simulations. */
export function isBetaPlan(profile: UserBillingProfile): boolean {
  const plan = (profile.planType ?? "").trim().toUpperCase();
  return plan === "BETA" || plan === "BETA_TESTER" || plan === "EARLY_ACCESS";
}

/**
 * Active paid, Stripe trialing, Beta, or Admin — privileged clinical learners.
 * These users must not hit unjustified simulation start blocks.
 */
export function isActiveOrBetaLearner(profile: UserBillingProfile): boolean {
  if (isAdmin(profile)) return true;
  if (isBetaPlan(profile)) return true;
  if (hasActiveSubscription(profile)) return true;
  return false;
}

export function hasActiveSubscription(profile: UserBillingProfile): boolean {
  if (isAdmin(profile)) return true;
  if (!isSubscriptionPlan(profile.planType)) return false;
  if (!profile.subscriptionStatus) return false;
  return ACTIVE_SUBSCRIPTION_STATUSES.has(profile.subscriptionStatus);
}

export type SimulationAccessOptions = {
  /** When set, purchasers of this bundle may start without the soft daily cap. */
  caseBundleId?: string | null;
  /** Simulations already started today (Europe/Rome). */
  usedToday?: number;
  /**
   * Client-supplied quota skip. Honored ONLY when `NODE_ENV === "development"`.
   * Production / staging / test ignore this flag even if set to true.
   */
  bypassDailyLimit?: boolean;
};

/** True when this start should count against the soft daily quota. */
export function shouldCountAgainstDailyQuota(
  profile: UserBillingProfile,
  options?: SimulationAccessOptions,
): boolean {
  if (canHonorDailyLimitBypass(options?.bypassDailyLimit)) return false;
  if (isActiveOrBetaLearner(profile)) return false;
  const bundleId = options?.caseBundleId?.trim();
  if (bundleId && profile.purchasedBundleIds.includes(bundleId)) return false;
  return true;
}

/** @deprecated Prefer shouldCountAgainstDailyQuota */
export const shouldConsumeFreeTrial = shouldCountAgainstDailyQuota;

export function assertCanStartSimulation(
  profile: UserBillingProfile,
  options?: SimulationAccessOptions,
): GateResult {
  if (canHonorDailyLimitBypass(options?.bypassDailyLimit)) {
    return { allowed: true };
  }

  // Active / Beta / Admin / Stripe trialing: always allowed.
  if (isActiveOrBetaLearner(profile)) {
    return { allowed: true };
  }

  const bundleId = options?.caseBundleId?.trim();
  if (bundleId && profile.purchasedBundleIds.includes(bundleId)) {
    return { allowed: true };
  }

  const usedToday = options?.usedToday ?? 0;
  if (usedToday >= DAILY_SIMULATION_LIMIT) {
    return {
      allowed: false,
      code: "DAILY_LIMIT",
      status: 403,
      message: `Hai esaurito le ${DAILY_SIMULATION_LIMIT} simulazioni di oggi. Il contatore si resetta a mezzanotte.`,
    };
  }

  return { allowed: true };
}

export function assertCanAccessBundle(
  profile: UserBillingProfile,
  bundleId: string | null | undefined,
): GateResult {
  if (!bundleId?.trim()) return { allowed: true };
  if (isActiveOrBetaLearner(profile)) return { allowed: true };
  if (profile.purchasedBundleIds.includes(bundleId)) return { allowed: true };

  return {
    allowed: false,
    code: "BUNDLE_LOCKED",
    status: 402,
    message:
      "Questo pacchetto di casi è a pagamento. Acquista il bundle o abbonati per sbloccarlo.",
  };
}

/** Counts only non-empty user turns (anamnesis questions from the clinician). */
export function countUserChatMessages(messages: { role: string; content: string }[]): number {
  if (!Array.isArray(messages)) return 0;
  return messages.filter((m) => m.role === "user" && typeof m.content === "string" && m.content.trim().length > 0)
    .length;
}

/**
 * Resolves the per-session user-message cap.
 * Override via `caseInput.maxUserMessages` (clamped to scientific bounds).
 */
export function resolveClinicalUserMessageLimit(override?: unknown): number {
  const n = typeof override === "number" ? override : Number(override);
  if (!Number.isFinite(n)) return DEFAULT_CLINICAL_USER_MESSAGE_LIMIT;
  const floored = Math.floor(n);
  if (floored < MIN_CLINICAL_USER_MESSAGE_LIMIT) return MIN_CLINICAL_USER_MESSAGE_LIMIT;
  if (floored > MAX_CLINICAL_USER_MESSAGE_LIMIT) return MAX_CLINICAL_USER_MESSAGE_LIMIT;
  return floored;
}

/**
 * Clinical session chat gate — counts user messages only.
 * Same scientific cap for all plans (complex anamnesis must not be truncated early).
 * Soft-stop returns ANAMNESIS_COMPLETE (not a raw billing error).
 */
export function assertCanSendChatMessage(
  _profile: UserBillingProfile,
  messages: { role: string; content: string }[],
  options?: { maxUserMessages?: unknown },
): GateResult {
  const limit = resolveClinicalUserMessageLimit(options?.maxUserMessages);
  const userMessageCount = countUserChatMessages(messages);

  if (userMessageCount > limit) {
    return {
      allowed: false,
      code: "ANAMNESIS_COMPLETE",
      status: 429,
      message: ANAMNESIS_COMPLETE_MESSAGE,
    };
  }

  return { allowed: true };
}

/** Patient chat model — always gpt-4o-mini for every plan. */
export function resolveChatModel(_profile?: UserBillingProfile): ChatModelId {
  return "gpt-4o-mini";
}

export function assertAllowedChatModel(
  _profile: UserBillingProfile,
  _requestedModel: unknown,
): GateResult {
  // Client-requested model is ignored — chat is always gpt-4o-mini (resolveChatModel).
  return { allowed: true };
}

export function gateToResponse(gate: Extract<GateResult, { allowed: false }>): Response {
  const isAnamnesisComplete = gate.code === "ANAMNESIS_COMPLETE";

  const body = isAnamnesisComplete
    ? {
        error: gate.message,
        code: gate.code,
        message: gate.message,
        anamnesisComplete: true as const,
        nextSteps: [
          "Procedi con gli esami di laboratorio o strumentali",
          "Oppure formula la diagnosi finale e completa il referto",
        ],
      }
    : {
        error: gate.message,
        code: gate.code,
      };

  return new Response(JSON.stringify(body), {
    status: gate.status,
    headers: { "Content-Type": "application/json" },
  });
}
