import { AnalyticsHub } from "@/components/analytics/AnalyticsHub";
import { fetchAnalyticsPageData } from "@/lib/analytics/analytics-queries";
import { requireUser } from "@/lib/require-user";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AnalyticsPage() {
  const user = await requireUser();
  const data = await fetchAnalyticsPageData(user.id);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-6 md:p-8">
      <header className="space-y-1">
        <h1 className="font-display text-2xl font-bold tracking-tight text-[#1E324E] md:text-[28px]">
          Performance
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-slate-500">
          Come stai andando nei casi, e dove sei rispetto agli altri medici in formazione.
        </p>
      </header>

      <AnalyticsHub initialData={data} />
    </div>
  );
}
