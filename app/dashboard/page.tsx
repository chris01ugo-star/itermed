import { redirect } from "next/navigation";
import { BarChart3, History } from "lucide-react";
import { CompetencyRadarChart } from "@/components/overview/CompetencyRadarChart";
import { OverviewHero } from "@/components/overview/OverviewHero";
import { OverviewQuickActions } from "@/components/overview/OverviewQuickActions";
import { RecentSessionsTimeline } from "@/components/overview/RecentSessionsTimeline";
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
  const overview = await fetchUserOverviewData(user.id);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 p-6 md:p-8">
      <OverviewHero
        userName={user.name}
        completedCount={overview.completedCount}
        casesThisWeek={overview.casesThisWeek}
        focusLabel={overview.focusLabel}
        iterMedScore={overview.iterMedScore}
        focusShort={overview.focusShort}
        streakDays={overview.streakDays}
      />

      <section className="grid grid-cols-1 items-stretch gap-5 lg:grid-cols-12">
        <div className="rounded-xl border border-border bg-panel-bg shadow-aequan-panel lg:col-span-7">
          <div className="flex items-center gap-2.5 border-b border-border-subtle px-5 py-4">
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
          <div className="px-4 py-4">
            {overview.completedCount > 0 ? (
              <div className="relative flex h-[280px] w-full items-center justify-center">
                <CompetencyRadarChart data={overview.radarData} />
              </div>
            ) : (
              <div className="flex h-[220px] w-full flex-col items-center justify-center gap-2 px-4 text-center">
                <p className="text-sm text-slate-500">
                  Completa il primo caso per vedere il profilo competenze.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-5">
          <OverviewQuickActions
            focusShort={overview.focusShort}
            casesThisWeek={overview.casesThisWeek}
          />
        </div>
      </section>

      <div className="rounded-xl border border-border bg-panel-bg shadow-aequan-panel">
        <div className="flex items-center gap-2.5 border-b border-border-subtle px-5 py-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
            <History className="h-4 w-4" />
          </div>
          <div>
            <h2 className="font-display text-sm font-semibold text-brand-primary">Ultimi casi</h2>
            <p className="mt-0.5 text-xs text-slate-500">Sessioni completate di recente</p>
          </div>
        </div>
        <div className="scrollbar-aequan max-h-80 overflow-y-auto px-5 py-4">
          <RecentSessionsTimeline sessions={overview.recentSessions} />
        </div>
      </div>
    </div>
  );
}
