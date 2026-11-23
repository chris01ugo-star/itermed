import Link from "next/link";
import { CreditCard } from "lucide-react";

export function PlanStatusBar({
  subscribed,
  planName,
  monthlyBalance,
  monthlyCredits,
  purchased,
  referral,
  total,
}: {
  subscribed: boolean;
  planName: string | null;
  monthlyBalance: number;
  monthlyCredits: number;
  purchased: number;
  referral: number;
  total: number;
}) {
  if (!subscribed) {
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-panel-bg px-5 py-4 shadow-aequan-panel sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#E4EAF3] text-[#345884]">
            <CreditCard className="h-[18px] w-[18px]" strokeWidth={1.75} />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              Piani Start e Plus
            </p>
            <p className="mt-0.5 font-display text-lg font-semibold text-text-primary">
              Da 9,90 € al mese
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              Sblocca tutte le specialità della Prassi.
            </p>
          </div>
        </div>
        <Link
          href="/dashboard/billing"
          className="inline-flex h-10 items-center justify-center rounded-xl bg-[#1E324E] px-4 text-sm font-semibold text-white"
        >
          Scegli il piano
        </Link>
      </div>
    );
  }

  const monthlyUsed = Math.max(0, monthlyCredits - monthlyBalance);
  const monthlyPct =
    monthlyCredits > 0
      ? Math.min(100, Math.round((monthlyUsed / monthlyCredits) * 100))
      : 0;

  return (
    <div className="rounded-xl border border-border bg-panel-bg px-5 py-4 shadow-aequan-panel">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
            {planName ?? "Abbonamento"}
          </p>
          <p className="mt-0.5 font-display text-lg font-semibold tabular-nums text-text-primary">
            {monthlyUsed}/{monthlyCredits} del piano questo mese
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {total} disponibili in tutto
            {purchased + referral > 0
              ? ` · Extra ${purchased} · Referral ${referral}`
              : ""}
          </p>
        </div>
        <Link
          href="/dashboard/billing"
          className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700"
        >
          Gestisci piano
        </Link>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200/80">
        <div
          className="h-full rounded-full bg-[#345884] transition-all"
          style={{ width: `${monthlyCredits <= 0 ? 0 : Math.max(monthlyPct === 0 ? 0 : 6, monthlyPct)}%` }}
        />
      </div>
    </div>
  );
}
