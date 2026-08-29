import { AnalyticsHub } from "@/components/analytics/AnalyticsHub";
import { fetchAnalyticsPageData } from "@/lib/analytics/analytics-queries";
import { requireUser } from "@/lib/require-user";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AnalyticsPage() {
  const user = await requireUser();
  // fetchAnalyticsPageData never throws — empty leaderboard/stats when DB is empty or errors.
  const data = await fetchAnalyticsPageData(user.id);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 p-6 md:p-8">
      {data.leaderboard.top50.length === 0 && data.statistics.completedCount === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-5 text-sm text-slate-600 shadow-sm">
          <p className="text-base font-medium text-slate-800">Nessuna simulazione completata</p>
          <p className="mt-1 text-sm text-slate-500">
            Completa il primo caso in Casi Clinici per vedere classifiche e trend.
          </p>
        </div>
      ) : null}

      <AnalyticsHub initialData={data} />
    </div>
  );
}
