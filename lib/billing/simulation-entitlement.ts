/**
 * Resolves whether an account may play, and which free-case cap applies.
 * Admin `freeSimulationLimit` overrides hardcoded pilot (3) / sponsored (20) defaults.
 */

import { DAILY_SIMULATION_LIMIT } from "@/lib/billing/plans";
import {
  hasUnlimitedCaseAccess,
  isSponsoredFreeCaseEmail,
  SPONSORED_FREE_CASE_LIMIT,
} from "@/lib/billing/unlimited-case-access";
import { isPilotAllowedEmail, PILOT_SIMULATION_CAP } from "@/lib/pilot-whitelist";

export const ACCOUNT_DISABLED_CODE = "ACCOUNT_DISABLED";
export const ACCOUNT_DISABLED_MESSAGE =
  "Questo account è stato disattivato. Contatta un amministratore Aequan.";

/** Stored on User.freeSimulationLimit when an admin grants unlimited cases. */
export const UNLIMITED_SIMULATION_SENTINEL = -1;
export const MAX_ADMIN_FREE_SIMULATION_LIMIT = 500;

export type SimulationEntitlementActor = {
  isActive?: boolean | null;
  role?: string | null;
  email?: string | null;
  freeSimulationLimit?: number | null;
};

export type SimulationEntitlement = {
  isActive: boolean;
  unlimited: boolean;
  /** Lifetime CaseSession cap. Null when unlimited or daily-only. */
  lifetimeLimit: number | null;
  kind: "disabled" | "unlimited" | "lifetime" | "daily";
  source: "inactive" | "admin" | "override" | "sponsored" | "pilot" | "daily";
};

function parseLimitOverride(raw: number | null | undefined): "unlimited" | number | null {
  if (raw == null || !Number.isFinite(raw)) return null;
  const n = Math.floor(raw);
  if (n === UNLIMITED_SIMULATION_SENTINEL) return "unlimited";
  if (n < 0) return 0;
  return Math.min(MAX_ADMIN_FREE_SIMULATION_LIMIT, n);
}

export function resolveSimulationEntitlement(
  actor: SimulationEntitlementActor | null | undefined,
): SimulationEntitlement {
  if (!actor || actor.isActive === false) {
    return {
      isActive: false,
      unlimited: false,
      lifetimeLimit: 0,
      kind: "disabled",
      source: "inactive",
    };
  }

  if (hasUnlimitedCaseAccess(actor)) {
    return {
      isActive: true,
      unlimited: true,
      lifetimeLimit: null,
      kind: "unlimited",
      source: "admin",
    };
  }

  const override = parseLimitOverride(actor.freeSimulationLimit);
  if (override === "unlimited") {
    return {
      isActive: true,
      unlimited: true,
      lifetimeLimit: null,
      kind: "unlimited",
      source: "override",
    };
  }
  if (typeof override === "number") {
    return {
      isActive: true,
      unlimited: false,
      lifetimeLimit: override,
      kind: "lifetime",
      source: "override",
    };
  }

  if (isSponsoredFreeCaseEmail(actor.email)) {
    return {
      isActive: true,
      unlimited: false,
      lifetimeLimit: SPONSORED_FREE_CASE_LIMIT,
      kind: "lifetime",
      source: "sponsored",
    };
  }

  if (isPilotAllowedEmail(actor.email)) {
    return {
      isActive: true,
      unlimited: false,
      lifetimeLimit: PILOT_SIMULATION_CAP,
      kind: "lifetime",
      source: "pilot",
    };
  }

  return {
    isActive: true,
    unlimited: false,
    lifetimeLimit: null,
    kind: "daily",
    source: "daily",
  };
}

/** Current numeric cap used by the admin stepper (daily users start from the 3-sim default). */
export function effectiveEditableLimit(actor: SimulationEntitlementActor): number | "unlimited" {
  const entitlement = resolveSimulationEntitlement(actor);
  if (entitlement.unlimited) return "unlimited";
  if (entitlement.lifetimeLimit != null) return entitlement.lifetimeLimit;
  return DAILY_SIMULATION_LIMIT;
}

export function nextStoredFreeSimulationLimit(
  current: number | "unlimited",
  delta: number,
): number {
  if (current === "unlimited") {
    if (delta < 0) {
      return Math.max(0, DAILY_SIMULATION_LIMIT + delta);
    }
    return UNLIMITED_SIMULATION_SENTINEL;
  }
  const next = current + delta;
  if (next < 0) return 0;
  if (next > MAX_ADMIN_FREE_SIMULATION_LIMIT) return MAX_ADMIN_FREE_SIMULATION_LIMIT;
  return Math.floor(next);
}

export function lifetimeCapMessage(limit: number): string {
  return `Hai raggiunto il limite di ${limit} simulazioni previsto per il tuo account.`;
}
