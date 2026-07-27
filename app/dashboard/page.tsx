import { redirect } from "next/navigation";
import { BarChart3, History } from "lucide-react";
import { CompetencyRadarChart } from "@/components/overview/CompetencyRadarChart";
import { DailySimQuotaBanner } from "@/components/overview/DailySimQuotaBanner";
import { OverviewHero } from "@/components/overview/OverviewHero";
import { OverviewQuickActions } from "@/components/overview/OverviewQuickActions";
import { OverviewStatsBar } from "@/components/overview/OverviewStatsBar";
import { RecentSessionsTimeline } from "@/components/overview/RecentSessionsTimeline";
import { getDailySimulationQuota } from "@/lib/billing/daily-sim-quota";
import { fetchUserOverviewData } from "@/lib/overview-queries";
import { requireUser } from "@/lib/require-user";

type DashboardPageProps = {
  searchParams?: Promise<{ specialty?: string }> | { specialty?: string };
};

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const resolvedSearch =
    searchParams && "then" in searchParams ? await searchParams : searchParams;
  if (resolvedSearch?.specialty?.trim()) {
    redirect(
      `/dashboard/prassi?specialty=${encodeURIComponent(resolvedSearch.specialty.trim())}`,
    );
  }

  const user = await requireUser();
  const [overview, dailyQuota] = await Promise.all([
    fetchUserOverviewData(user.id),
    getDailySimulationQuota(user.id),
  ]);

  const bestDimension = overview.radarData.reduce(
    (best, point) => (point.score > best.score ? point : best),
    overview.radarData[0],
  );
  const worstDimension = overview.radarData.reduce(
    (worst, point) => (point.score < worst.score ? point : worst),
    overview.radarData[0],
  );

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-6 md:p-8">
      <OverviewHero
        userName={user.name}
        completedCount={overview.completedCount}
        casesThisWeek={overview.casesThisWeek}
        focusLabel={overview.focusLabel}
      />

      <DailySimQuotaBanner
        remaining={dailyQuota.remaining}
        limit={dailyQuota.limit}
        used={dailyQuota.used}
      />

      <OverviewStatsBar
        completedCount={overview.completedCount}
        iterMedScore={overview.iterMedScore}
        focusShort={overview.focusShort}
        streakDays={overview.streakDays}
      />

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="flex flex-col rounded-xl border border-border bg-panel-bg shadow-aequan-panel lg:col-span-7">
          <div className="border-b border-border-subtle">
            <div className="flex items-center gap-2.5 px-5 py-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                <BarChart3 className="h-4 w-4" />
              </div>
              <div>
                <h2 className="font-display text-sm font-semibold text-brand-primary">
                  Profilo competenze
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">Media sulle 5 dimensioni (0–100)</p>
              </div>
            </div>
            {overview.completedCount > 0 ? (
              <div className="flex flex-wrap items-center gap-2 border-t border-border-subtle bg-ui-bg/50 px-5 py-2.5">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                  Punto di forza: {bestDimension.metric} ({bestDimension.score})
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                  Da migliorare: {worstDimension.metric} ({worstDimension.score})
                </span>
              </div>
            ) : null}
          </div>

          {overview.completedCount > 0 ? (
            <div className="flex flex-1 flex-col gap-2 p-5 sm:flex-row">
              <div className="relative min-h-[260px] w-full flex-1">
                <CompetencyRadarChart data={overview.radarData} />
              </div>
              <div className="flex w-full shrink-0 flex-col justify-center gap-2.5 sm:w-[190px]">
                {overview.radarData.map((point) => (
                  <div key={point.metric} className="rounded-lg bg-ui-bg/80 px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-xs font-medium text-slate-600">{point.metric}</p>
                      <p className="text-xs font-semibold tabular-nums text-text-primary">
                        {point.score}
                      </p>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-brand-secondary"
                        style={{ width: `${Math.max(4, point.score)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-1 w-full flex-col items-center justify-center gap-2 px-6 py-10 text-center">
              <p className="text-sm text-slate-500">
                Completa il primo caso per vedere il tuo profilo competenze.
              </p>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4 lg:col-span-5">
          <OverviewQuickActions
            focusShort={overview.focusShort}
            casesThisWeek={overview.casesThisWeek}
          />

          <div className="rounded-xl border border-border bg-panel-bg shadow-aequan-panel">
            <div className="flex items-center gap-2.5 border-b border-border-subtle px-4 py-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                <History className="h-4 w-4" />
              </div>
              <div>
                <h2 className="font-display text-sm font-semibold text-brand-primary">
                  Ultimi casi
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">Sessioni completate di recente</p>
              </div>
            </div>
            <div className="scrollbar-aequan max-h-64 overflow-y-auto px-4 py-1">
              <RecentSessionsTimeline sessions={overview.recentSessions.slice(0, 5)} compact />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
