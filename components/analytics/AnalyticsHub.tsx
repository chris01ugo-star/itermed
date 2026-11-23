"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { Award, Target, TrendingUp, Trophy } from "lucide-react";
import type { AnalyticsPageData } from "@/lib/analytics/analytics-types";
import { PersonalProfilePanel } from "@/components/analytics/PersonalProfilePanel";
import { ClinicalPerformanceRegistry } from "@/components/analytics/ClinicalPerformanceRegistry";
import { ScoreTrendChart } from "@/components/statistics/ScoreTrendChart";
import { AiClinicalCoach } from "@/components/statistics/AiClinicalCoach";
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

  const weakest = useMemo(() => {
    if (statistics.completedCount === 0) return null;
    return OVERVIEW_RADAR_METRICS.reduce((lowest, item) => {
      const score = statistics.overallAverages[item.key] ?? 0;
      const lowestScore = statistics.overallAverages[lowest.key] ?? 0;
      return score < lowestScore ? item : lowest;
    });
  }, [statistics.completedCount, statistics.overallAverages]);

  return (
    <div className="flex flex-col gap-6">
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SnapshotCard
          icon={Trophy}
          label="Posizione"
          value={
            optedIn && metrics.rank != null ? `#${metrics.rank}` : optedIn ? "—" : "Nascosto"
          }
          caption={
            optedIn && metrics.totalParticipants > 0
              ? `su ${metrics.totalParticipants} in classifica`
              : optedIn
                ? "Completa un caso per entrare"
                : "Rendi visibili i risultati sotto"
          }
        />
        <SnapshotCard
          icon={Award}
          label="Media casi"
          value={metrics.averageScore != null ? `${metrics.averageScore}/30` : "—"}
          caption={
            metrics.completedCount > 0
              ? `su ${metrics.completedCount} ${metrics.completedCount === 1 ? "caso" : "casi"}`
              : "Nessun caso completato"
          }
        />
        <SnapshotCard
          icon={TrendingUp}
          label="Casi completati"
          value={String(metrics.completedCount)}
          caption="Simulazioni con report chiuso"
        />
        <SnapshotCard
          icon={Target}
          label="Da migliorare"
          value={weakest ? weakest.metric : "—"}
          caption={
            weakest
              ? `${statistics.overallAverages[weakest.key]}/100 su questo ambito`
              : "Uscirà dopo il primo caso"
          }
        />
      </section>

      <section className="grid grid-cols-1 items-stretch gap-6 xl:grid-cols-12">
        <div className="min-h-[28rem] xl:col-span-7">
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

        <div className="flex flex-col gap-4 xl:col-span-5">
          <div className="overflow-hidden rounded-xl border border-border bg-panel-bg shadow-aequan-panel">
            <div className="border-b border-border-subtle px-5 py-4">
              <h2 className="font-display text-base font-semibold text-[#1E324E]">Competenze</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Media da 0 a 100 sui report completati.
              </p>
            </div>
            <div className="space-y-3.5 px-5 py-4">
              {statistics.completedCount === 0 ? (
                <p className="py-6 text-sm text-slate-500">
                  Completa un caso per vedere i cinque ambiti.
                </p>
              ) : (
                OVERVIEW_RADAR_METRICS.map(({ metric, key }) => {
                  const score = statistics.overallAverages[key] ?? 0;
                  const isWeakest = weakest?.key === key;
                  return (
                    <div key={key}>
                      <div className="mb-1 flex items-baseline justify-between gap-3">
                        <p
                          className={cn(
                            "text-sm",
                            isWeakest ? "font-semibold text-[#1E324E]" : "text-slate-700",
                          )}
                        >
                          {metric}
                        </p>
                        <p className="text-sm font-semibold tabular-nums text-[#1E324E]">{score}</p>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={cn(
                            "h-full rounded-full",
                            isWeakest ? "bg-amber-500" : "bg-[#345884]",
                          )}
                          style={{ width: `${Math.max(0, Math.min(100, score))}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-border bg-panel-bg shadow-aequan-panel">
            <div className="border-b border-border-subtle px-5 py-4">
              <h2 className="font-display text-base font-semibold text-[#1E324E]">
                Cosa migliorare
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Le aree con il punteggio più basso, in ordine.
              </p>
            </div>
            <div className="px-5 py-4">
              <AiClinicalCoach
                insights={statistics.completedCount === 0 ? [] : statistics.coachInsights}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-border bg-panel-bg shadow-aequan-panel">
        <div className="border-b border-border-subtle px-5 py-4">
          <h2 className="font-display text-base font-semibold text-[#1E324E]">Andamento</h2>
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

function SnapshotCard({
  icon: Icon,
  label,
  value,
  caption,
}: {
  icon: typeof Trophy;
  label: string;
  value: string;
  caption: string;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-panel-bg px-5 py-4 shadow-aequan-panel">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EEF2F9] text-[#345884]">
          <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-slate-500">{label}</p>
          <p className="truncate text-xl font-semibold tabular-nums text-[#1E324E]">{value}</p>
        </div>
      </div>
      <p className="text-xs leading-snug text-slate-400">{caption}</p>
    </div>
  );
}
