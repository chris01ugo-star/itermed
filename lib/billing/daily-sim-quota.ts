import "server-only";
import { prisma } from "@/lib/prisma";
import { DAILY_SIMULATION_LIMIT } from "@/lib/billing/plans";
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

export type DailySimulationQuota = {
  used: number;
  limit: number;
  remaining: number;
  exhausted: boolean;
  dayKey: string;
};

export async function getDailySimulationQuota(userId: string): Promise<DailySimulationQuota> {
  const used = await countSimulationsStartedToday(userId);
  const limit = DAILY_SIMULATION_LIMIT;
  const remaining = Math.max(0, limit - used);
  return {
    used,
    limit,
    remaining,
    exhausted: remaining <= 0,
    dayKey: romeDayKey(),
  };
}
