"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { Activity, BarChart3, Lightbulb, TrendingUp } from "lucide-react";
import type { AnalyticsPageData } from "@/lib/analytics/analytics-types";
import { PersonalProfilePanel } from "@/components/analytics/PersonalProfilePanel";
import { ClinicalPerformanceRegistry } from "@/components/analytics/ClinicalPerformanceRegistry";
import { ScoreTrendChart } from "@/components/statistics/ScoreTrendChart";
import { AiClinicalCoach } from "@/components/statistics/AiClinicalCoach";
import { OVERVIEW_RADAR_METRICS } from "@/lib/constants/overview-radar-metrics";
import { ResultsRadarClient } from "@/app/case/[id]/results/ResultsRadarClient";

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
  const isOutsideTop50 =
    currentEntry != null &&
    currentEntry.rank > 50 &&
    !leaderboard.top50.some((e) => e.isCurrentUser);

  const radarData = useMemo(
    () =>
      OVERVIEW_RADAR_METRICS.map(({ metric, key }) => ({
        metric,
        score: statistics.overallAverages[key] ?? 0,
        target: 100,
      })),
    [statistics.overallAverages],
  );

  return (
    <div className="flex flex-col gap-6">
      <section className="grid grid-cols-1 items-stretch gap-4 xl:grid-cols-[minmax(17rem,0.9fr)_minmax(0,1.7fr)]">
        <PersonalProfilePanel
          metrics={leaderboard.currentUser.metrics}
          preferences={leaderboard.currentUser.preferences}
          entry={currentEntry}
          top50={leaderboard.top50}
          onUpdated={refreshLeaderboard}
        />

        <ClinicalPerformanceRegistry
          entries={leaderboard.top50}
          currentUserOutsideTop50={isOutsideTop50 ? currentEntry : null}
          totalParticipants={leaderboard.currentUser.metrics.totalParticipants}
        />
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_0_rgba(15,23,42,0.03)] lg:col-span-7">
          <div className="flex items-center gap-2.5 border-b border-slate-100 px-5 py-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#EEF2F9] text-[#345884]">
              <Activity className="h-4 w-4" strokeWidth={1.75} />
            </div>
            <div>
              <h2 className="font-display text-sm font-semibold text-[#1E324E]">
                Radar competenze
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Media sulle simulazioni completate vs target formativo.
              </p>
            </div>
          </div>
          <div className="h-80 px-4 py-4">
            {statistics.completedCount === 0 ? (
              <p className="flex h-full items-center justify-center text-sm text-slate-500">
                Completa un caso per vedere il radar.
              </p>
            ) : (
              <ResultsRadarClient data={radarData} />
            )}
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_0_rgba(15,23,42,0.03)] lg:col-span-5">
          <div className="flex items-center gap-2.5 border-b border-slate-100 px-5 py-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#EEF2F9] text-[#345884]">
              <BarChart3 className="h-4 w-4" strokeWidth={1.75} />
            </div>
            <div>
              <h2 className="font-display text-sm font-semibold text-[#1E324E]">
                Medie per dimensione
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">Snapshot su tutti i report completati.</p>
            </div>
          </div>
          <div className="px-5 py-4">
            {statistics.completedCount === 0 ? (
              <p className="text-sm text-slate-500">Nessun dato disponibile.</p>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {OVERVIEW_RADAR_METRICS.map(({ metric, key }) => (
                  <div
                    key={key}
                    className="rounded-xl border border-slate-100 bg-slate-50/70 px-3.5 py-3"
                  >
                    <p className="text-[10px] uppercase tracking-wide text-slate-400">{metric}</p>
                    <p className="mt-0.5 font-display text-xl font-semibold tabular-nums text-[#1E324E]">
                      {statistics.overallAverages[key]}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_0_rgba(15,23,42,0.03)]">
        <div className="flex items-center gap-2.5 border-b border-slate-100 px-5 py-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#EEF2F9] text-[#345884]">
            <TrendingUp className="h-4 w-4" strokeWidth={1.75} />
          </div>
          <div>
            <h2 className="font-display text-sm font-semibold text-[#1E324E]">Trend punteggi</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Andamento del punteggio totale nelle ultime sessioni completate.
            </p>
          </div>
        </div>
        <div className="px-5 py-4">
          <ScoreTrendChart data={statistics.trend} />
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_0_rgba(15,23,42,0.03)]">
        <div className="flex items-center gap-2.5 border-b border-slate-100 px-5 py-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#EEF2F9] text-[#345884]">
            <Lightbulb className="h-4 w-4" strokeWidth={1.75} />
          </div>
          <div>
            <h2 className="font-display text-sm font-semibold text-[#1E324E]">
              Raccomandazioni clinico-legali
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Aree prioritarie di miglioramento basate sulle tue performance.
            </p>
          </div>
        </div>
        <div className="px-5 py-4">
          <AiClinicalCoach insights={statistics.coachInsights} />
        </div>
      </section>
    </div>
  );
}
