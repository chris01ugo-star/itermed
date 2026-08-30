import { BarChart3 } from "lucide-react";
import { AnalyticsHub } from "@/components/analytics/AnalyticsHub";
import { fetchAnalyticsPageData } from "@/lib/analytics/analytics-queries";
import { requireUser } from "@/lib/require-user";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AnalyticsPage() {
  const user = await requireUser();
  // fetchAnalyticsPageData never throws — empty leaderboard/stats when DB is empty or errors.
  const data = await fetchAnalyticsPageData(user.id);
  const hasNoData =
    data.leaderboard.top50.length === 0 && data.statistics.completedCount === 0;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 p-6 md:p-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 text-[#345884]">
            <BarChart3 className="h-4 w-4" strokeWidth={1.75} />
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em]">
              Performance
            </span>
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-[#1E324E] md:text-[28px]">
            Analytics &amp; Classifica
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-slate-500">
            Confrontati con altri medici in formazione, segui i tuoi trend e scala la classifica
            nazionale caso dopo caso.
          </p>
        </div>
      </header>

      {hasNoData ? (
        <div className="rounded-2xl border border-dashed border-[#345884]/25 bg-[#EEF2F9]/60 px-5 py-5">
          <p className="font-display text-base font-semibold text-[#1E324E]">
            La tua classifica parte da qui
          </p>
          <p className="mt-1 text-sm text-slate-600">
            Completa il primo caso in Casi Clinici: otterrai un punteggio, un posto in classifica e
            i primi insight di miglioramento.
          </p>
        </div>
      ) : null}

      <AnalyticsHub initialData={data} />
    </div>
  );
}
