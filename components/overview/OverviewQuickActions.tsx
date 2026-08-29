import Link from "next/link";
import { ArrowRight, Calendar, Target } from "lucide-react";

type OverviewQuickActionsProps = {
  focusShort: string;
  casesThisWeek: number;
};

const WEEKLY_GOAL = 5;

export function OverviewQuickActions({ focusShort, casesThisWeek }: OverviewQuickActionsProps) {
  const weekProgress = Math.min(100, Math.round((casesThisWeek / WEEKLY_GOAL) * 100));

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-panel-bg p-3.5 shadow-aequan-panel">
      <Link
        href="/dashboard/prassi"
        className="group relative flex items-center justify-between gap-4 overflow-hidden rounded-lg bg-gradient-to-br from-brand-primary to-[#152437] px-4 py-4 text-white transition-shadow hover:shadow-md"
      >
        <span
          className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-white/[0.06]"
          aria-hidden
        />
        <span
          className="pointer-events-none absolute -bottom-10 right-10 h-20 w-20 rounded-full bg-white/[0.04]"
          aria-hidden
        />
        <div className="relative min-w-0">
          <p className="text-sm font-semibold">Casi Clinici</p>
          <p className="mt-0.5 text-xs text-white/70">Apri la libreria casi e avvia una sessione</p>
        </div>
        <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 transition-all group-hover:bg-white/25 group-hover:translate-x-0.5">
          <ArrowRight className="h-4 w-4" />
        </span>
      </Link>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <div className="flex items-center gap-2.5 rounded-lg bg-ui-bg/70 px-3.5 py-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
            <Target className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] text-slate-500">Da migliorare</p>
            <p className="mt-0.5 truncate text-sm font-semibold text-text-primary">{focusShort}</p>
          </div>
        </div>

        <div className="rounded-lg bg-ui-bg/70 px-3.5 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-slate-600 shadow-sm ring-1 ring-slate-100">
              <Calendar className="h-4 w-4" />
            </div>
            <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
              <p className="text-[11px] text-slate-500">Questa settimana</p>
              <span className="text-sm font-semibold tabular-nums text-text-primary">
                {casesThisWeek}/{WEEKLY_GOAL}
              </span>
            </div>
          </div>
          <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-slate-200/70">
            <div
              className="h-full rounded-full bg-brand-secondary transition-all"
              style={{ width: `${weekProgress}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
