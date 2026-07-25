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
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-panel-bg shadow-aequan-panel">
      <Link
        href="/dashboard/prassi"
        className="group flex items-center justify-between gap-4 bg-brand-primary px-5 py-5 text-white transition hover:bg-brand-primary-hover"
      >
        <div>
          <p className="text-base font-semibold">Prassi Clinica</p>
          <p className="mt-1 text-sm text-white/75">Apri la libreria casi e avvia una sessione</p>
        </div>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15 transition group-hover:scale-105">
          <ArrowRight className="h-5 w-5" />
        </span>
      </Link>

      <div className="grid flex-1 grid-cols-1 divide-y divide-border-subtle sm:grid-cols-2 sm:divide-x sm:divide-y-0">
        <div className="flex items-start gap-2.5 px-5 py-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
            <Target className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-slate-500">Da migliorare</p>
            <p className="mt-0.5 truncate text-sm font-semibold text-text-primary">{focusShort}</p>
          </div>
        </div>

        <div className="px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
              <Calendar className="h-4 w-4" />
            </div>
            <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
              <p className="text-xs text-slate-500">Questa settimana</p>
              <span className="text-sm font-semibold tabular-nums text-text-primary">
                {casesThisWeek}/{WEEKLY_GOAL}
              </span>
            </div>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
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
