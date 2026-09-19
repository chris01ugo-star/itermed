import "server-only";
import { prisma } from "@/lib/prisma";
import { DAILY_SIMULATION_LIMIT } from "@/lib/billing/plans";
import {
  getSponsoredFreeCaseLimit,
  hasUnlimitedCaseAccess,
} from "@/lib/billing/unlimited-case-access";
import { isPilotAllowedEmail, PILOT_SIMULATION_CAP } from "@/lib/pilot-whitelist";
import { config, isUsableDatabase } from "@/lib/config";
import { createLogger } from "@/lib/logger";

const log = createLogger("daily-sim-quota");
const ROME_TZ = "Europe/Rome";

/** Calendar day key in Europe/Rome (YYYY-MM-DD). */
export function romeDayKey(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ROME_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Start of the current calendar day in Europe/Rome, as a UTC Date. */
export function startOfTodayRome(now: Date = new Date()): Date {
  const day = romeDayKey(now);
  // Noon UTC on that civil date is always still that Rome day in winter/summer.
  let t = Date.parse(`${day}T12:00:00.000Z`);
  while (romeDayKey(new Date(t - 3_600_000)) === day) {
    t -= 3_600_000;
  }
  while (romeDayKey(new Date(t - 60_000)) === day) {
    t -= 60_000;
  }
  while (romeDayKey(new Date(t - 1000)) === day) {
    t -= 1000;
  }
  return new Date(t);
}

export async function countSimulationsStartedToday(userId: string): Promise<number> {
  if (!userId || !isUsableDatabase(config.DATABASE_URL)) {
    return 0;
  }

  try {
    return await prisma.caseSession.count({
      where: {
        userId,
        createdAt: { gte: startOfTodayRome() },
      },
    });
  } catch (error) {
    log.warn("caseSession.count unavailable; treating daily usage as 0 (offline / DB down)", {
      userId,
      errorName: error instanceof Error ? error.name : undefined,
      errorMessage: error instanceof Error ? error.message.slice(0, 240) : String(error).slice(0, 240),
    });
    return 0;
  }
}

/** Lifetime CaseSession count (sponsored grant tracking). */
export async function countSimulationsStartedAllTime(userId: string): Promise<number> {
  if (!userId || !isUsableDatabase(config.DATABASE_URL)) {
    return 0;
  }

  try {
    return await prisma.caseSession.count({
      where: { userId },
    });
  } catch (error) {
    log.warn("caseSession lifetime count unavailable; treating usage as 0 (offline / DB down)", {
      userId,
      errorName: error instanceof Error ? error.name : undefined,
      errorMessage: error instanceof Error ? error.message.slice(0, 240) : String(error).slice(0, 240),
    });
    return 0;
  }
}

export type DailySimulationQuota = {
  used: number;
  limit: number;
  remaining: number;
  exhausted: boolean;
  unlimited: boolean;
  dayKey: string;
  /** `sponsored` = lifetime complimentary bundle; `pilot` = university 3-case cap. */
  kind: "daily" | "sponsored" | "unlimited" | "pilot";
};

export async function getDailySimulationQuota(
  userId: string,
  actor?: { role?: string | null; email?: string | null },
): Promise<DailySimulationQuota> {
  const privileged = actor
    ? hasUnlimitedCaseAccess(actor)
    : await isUnlimitedCaseUser(userId);

  const email = actor?.email ?? (await lookupUserEmail(userId));
  const sponsoredLimit = getSponsoredFreeCaseLimit(email);

  if (privileged) {
    const used = await countSimulationsStartedToday(userId);
    return {
      used,
      limit: DAILY_SIMULATION_LIMIT,
      remaining: DAILY_SIMULATION_LIMIT,
      exhausted: false,
      unlimited: true,
      dayKey: romeDayKey(),
      kind: "unlimited",
    };
  }

  if (isPilotAllowedEmail(email)) {
    const used = await countSimulationsStartedAllTime(userId);
    const remaining = Math.max(0, PILOT_SIMULATION_CAP - used);
    return {
      used,
      limit: PILOT_SIMULATION_CAP,
      remaining,
      exhausted: remaining <= 0,
      unlimited: false,
      dayKey: romeDayKey(),
      kind: "pilot",
    };
  }

  if (sponsoredLimit != null) {
    const used = await countSimulationsStartedAllTime(userId);
    const remaining = Math.max(0, sponsoredLimit - used);
    if (remaining > 0) {
      return {
        used,
        limit: sponsoredLimit,
        remaining,
        exhausted: false,
        unlimited: false,
        dayKey: romeDayKey(),
        kind: "sponsored",
      };
    }
  }

  const used = await countSimulationsStartedToday(userId);
  const limit = DAILY_SIMULATION_LIMIT;
  const remaining = Math.max(0, limit - used);
  return {
    used,
    limit,
    remaining,
    exhausted: remaining <= 0,
    unlimited: false,
    dayKey: romeDayKey(),
    kind: "daily",
  };
}

async function lookupUserEmail(userId: string): Promise<string | null> {
  if (!userId || !isUsableDatabase(config.DATABASE_URL)) return null;
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    return user?.email ?? null;
  } catch {
    return null;
  }
}

async function isUnlimitedCaseUser(userId: string): Promise<boolean> {
  if (!userId || !isUsableDatabase(config.DATABASE_URL)) return false;
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, email: true },
    });
    return hasUnlimitedCaseAccess(user);
  } catch (error) {
    log.warn("user lookup for quota bypass failed; applying standard daily limit", {
      userId,
      errorName: error instanceof Error ? error.name : undefined,
    });
    return false;
  }
}
