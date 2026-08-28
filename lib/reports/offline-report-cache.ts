/**
 * Client-side snapshot of a completed simulation report.
 * Used when `/case/[id]/results` cannot load SessionReport from Prisma/Neon.
 */

import type { EliteReportData } from "@/lib/services/simulation-report-data";

const STORAGE_PREFIX = "aequan:sim-report:";

export function offlineReportStorageKey(reportId: string): string {
  return `${STORAGE_PREFIX}${reportId.trim()}`;
}

export function writeOfflineReportCache(reportId: string, data: EliteReportData): void {
  if (typeof window === "undefined" || !reportId.trim()) return;
  try {
    window.sessionStorage.setItem(offlineReportStorageKey(reportId), JSON.stringify(data));
  } catch {
    /* quota / private mode */
  }
}

export function readOfflineReportCache(reportId: string): EliteReportData | null {
  if (typeof window === "undefined" || !reportId.trim()) return null;
  try {
    const raw = window.sessionStorage.getItem(offlineReportStorageKey(reportId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as EliteReportData;
    if (!parsed || typeof parsed !== "object" || !parsed.scores) return null;
    return parsed;
  } catch {
    return null;
  }
}
