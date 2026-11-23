"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import type { AnalyticsPageData } from "@/lib/analytics/analytics-types";
import { PersonalProfilePanel } from "@/components/analytics/PersonalProfilePanel";
import { ClinicalPerformanceRegistry } from "@/components/analytics/ClinicalPerformanceRegistry";
import { ScoreTrendChart } from "@/components/statistics/ScoreTrendChart";
import { AiClinicalCoach } from "@/components/statistics/AiClinicalCoach";
import { CompetencyRadarChart } from "@/components/overview/CompetencyRadarChart";
import { OVERVIEW_RADAR_METRICS } from "@/lib/constants/overview-radar-metrics";
import { cn } from "@/app/utils/cn";

type AnalyticsHubProps = {
  initialData: AnalyticsPageData;
};

export function AnalyticsHub({ initialData }: AnalyticsHubProps) {
  const [data, setData] = useState(initialData);
  const [, startTransition] = useTransition();

  const refreshLeaderboard = useCallback(() => {
    startTransition(async () => {
      const res = await fetch("/api/leaderboard");
      if (!res.ok) return;
      const leaderboard = await res.json();
      setData((prev) => ({ ...prev, leaderboard }));
    });
  }, []);

  const { leaderboard, statistics } = data;
  const currentEntry = leaderboard.currentUser.entry;
  const metrics = leaderboard.currentUser.metrics;
  const optedIn = leaderboard.currentUser.preferences.leaderboardOptIn;
  const isOutsideTop50 =
    currentEntry != null &&
    currentEntry.rank > 50 &&
    !leaderboard.top50.some((e) => e.isCurrentUser);

  const radarData = useMemo(
    () =>
      OVERVIEW_RADAR_METRICS.map(({ metric, key }) => ({
        metric,
        score: statistics.overallAverages[key] ?? 0,
      })),
    [statistics.overallAverages],
  );

  const weakest = useMemo(() => {
    if (statistics.completedCount === 0 || radarData.length === 0) return null;
    return radarData.reduce((lowest, item) => (item.score < lowest.score ? item : lowest));
  }, [radarData, statistics.completedCount]);

  const strongest = useMemo(() => {
    if (statistics.completedCount === 0 || radarData.length === 0) return null;
    return radarData.reduce((best, item) => (item.score > best.score ? item : best));
  }, [radarData, statistics.completedCount]);

  const rankLabel = optedIn && metrics.rank != null ? `#${metrics.rank}` : optedIn ? "—" : "Privato";
  const rankCaption = optedIn
    ? metrics.totalParticipants > 0
      ? `su ${metrics.totalParticipants} in classifica`
      : "completa un caso per entrare"
    : "risultati non visibili in elenco";

  return (
    <div className="flex flex-col gap-6">
      <section className="relative overflow-hidden rounded-2xl bg-[#1E324E] px-6 py-6 text-white shadow-aequan-panel sm:px-8 sm:py-7">
        <span
          className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-white/[0.06]"
          aria-hidden
        />
        <span
          className="pointer-events-none absolute -bottom-16 right-20 h-32 w-32 rounded-full bg-white/[0.04]"
          aria-hidden
        />
        <div className="relative grid gap-6 sm:grid-cols-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/50">
              Posizione
            </p>
            <p className="mt-2 font-display text-5xl font-bold tabular-nums leading-none tracking-tight">
              {rankLabel}
            </p>
            <p className="mt-2 text-sm text-white/65">{rankCaption}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/50">
              Media
            </p>
            <p className="mt-2 font-display text-5xl font-bold tabular-nums leading-none tracking-tight">
              {metrics.averageScore != null ? metrics.averageScore : "—"}
              {metrics.averageScore != null ? (
                <span className="ml-1 text-xl font-semibold text-white/45">/30</span>
              ) : null}
            </p>
            <p className="mt-2 text-sm text-white/65">
              {metrics.completedCount > 0
                ? `${metrics.completedCount} ${metrics.completedCount === 1 ? "caso completato" : "casi completati"}`
                : "nessun caso completato"}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/50">
              Focus
            </p>
            <p className="mt-2 font-display text-2xl font-semibold leading-tight tracking-tight sm:text-[28px]">
              {weakest ? weakest.metric : "—"}
            </p>
            <p className="mt-2 text-sm text-white/65">
              {weakest
                ? `${weakest.score}/100 · ambito più basso`
                : "esce dopo il primo caso"}
            </p>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
        <div className="xl:col-span-6">
          <ClinicalPerformanceRegistry
            entries={leaderboard.top50}
            currentUserOutsideTop50={isOutsideTop50 ? currentEntry : null}
            totalParticipants={metrics.totalParticipants}
            identity={
              <PersonalProfilePanel
                preferences={leaderboard.currentUser.preferences}
                onUpdated={refreshLeaderboard}
              />
            }
          />
        </div>

        <div className="overflow-hidden rounded-2xl border border-border bg-panel-bg shadow-aequan-panel xl:col-span-6">
          <div className="border-b border-border-subtle px-5 py-4">
            <h2 className="font-display text-sm font-semibold text-[#1E324E]">Profilo competenze</h2>
            <p className="mt-0.5 text-xs text-slate-500">Cinque ambiti, media 0–100 sui report chiusi.</p>
            {statistics.completedCount > 0 && strongest && weakest ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800">
                  Forza: {strongest.metric} {strongest.score}
                </span>
                <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800">
                  Focus: {weakest.metric} {weakest.score}
                </span>
              </div>
            ) : null}
          </div>

          {statistics.completedCount === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-slate-500">
              Completa un caso per vedere il profilo.
            </p>
          ) : (
            <>
              <div className="flex flex-col gap-2 p-5 sm:flex-row">
                <div className="relative min-h-[240px] w-full flex-1">
                  <CompetencyRadarChart data={radarData} />
                </div>
                <div className="flex w-full shrink-0 flex-col justify-center gap-2 sm:w-[200px]">
                  {radarData.map((point) => {
                    const isWeak = weakest?.metric === point.metric;
                    return (
                      <div key={point.metric} className="rounded-lg bg-[#F7F9FC] px-3 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-xs font-medium text-slate-600">{point.metric}</p>
                          <p className="text-xs font-semibold tabular-nums text-[#1E324E]">
                            {point.score}
                          </p>
                        </div>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200">
                          <div
                            className={cn(
                              "h-full rounded-full",
                              isWeak ? "bg-amber-500" : "bg-[#345884]",
                            )}
                            style={{ width: `${Math.max(4, Math.min(100, point.score))}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="border-t border-border-subtle px-5 py-4">
                <p className="text-xs font-semibold text-[#1E324E]">Cosa migliorare</p>
                <div className="mt-3">
                  <AiClinicalCoach insights={statistics.coachInsights.slice(0, 2)} />
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-border bg-panel-bg shadow-aequan-panel">
        <div className="border-b border-border-subtle px-5 py-4">
          <h2 className="font-display text-sm font-semibold text-[#1E324E]">Andamento</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Punteggio in trentesimi delle ultime simulazioni.
          </p>
        </div>
        <div className="px-5 py-4">
          <ScoreTrendChart data={statistics.trend} />
        </div>
      </section>
    </div>
  );
}
