"use client";

import { cn } from "@/app/utils/cn";

type EconomicBudgetGaugeProps = {
  targetBudget: number;
  actualSpent: number;
  wastedEuro?: number;
  className?: string;
};

export function EconomicBudgetGauge({
  targetBudget,
  actualSpent,
  wastedEuro = 0,
  className,
}: EconomicBudgetGaugeProps) {
  const ratio = targetBudget > 0 ? Math.min(actualSpent / targetBudget, 1.5) : 0;
  const fillPercent = Math.min(100, ratio * 100);
  const isOver = actualSpent > targetBudget;
  const isWarning = ratio > 0.85 && !isOver;

  const fillColor = isOver
    ? "bg-status-risk"
    : isWarning
      ? "bg-status-warn"
      : "bg-brand-secondary";

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            Utilizzo budget esami
          </p>
          <p className="mt-1 font-display text-2xl font-semibold tracking-tight text-text-primary tabular-nums">
            €{actualSpent.toFixed(0)}
            <span className="text-sm font-normal text-slate-500">
              {" "}
              / €{targetBudget.toFixed(0)}
            </span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-medium text-slate-500">Efficienza</p>
          <p
            className={cn(
              "font-display text-lg font-semibold tabular-nums",
              isOver
                ? "text-status-risk"
                : isWarning
                  ? "text-status-warn"
                  : "text-brand-secondary",
            )}
          >
            {targetBudget > 0 ? Math.round((targetBudget / Math.max(actualSpent, 1)) * 100) : 100}%
          </p>
        </div>
      </div>

      <div className="relative h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={cn(
            "absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out",
            fillColor,
          )}
          style={{ width: `${fillPercent}%` }}
          role="progressbar"
          aria-valuenow={Math.round(fillPercent)}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl border border-border bg-ui-bg/60 px-2 py-2.5">
          <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-500">
            Budget ideale
          </p>
          <p className="mt-0.5 text-sm font-semibold tabular-nums text-brand-secondary">
            €{targetBudget.toFixed(0)}
          </p>
        </div>
        <div
          className={cn(
            "rounded-xl border px-2 py-2.5",
            isOver
              ? "border-rose-200/80 bg-rose-50/80"
              : "border-border bg-ui-bg/60",
          )}
        >
          <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-500">Speso</p>
          <p
            className={cn(
              "mt-0.5 text-sm font-semibold tabular-nums",
              isOver ? "text-status-risk" : "text-brand-primary",
            )}
          >
            €{actualSpent.toFixed(0)}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-ui-bg/60 px-2 py-2.5">
          <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-500">
            Spreco stimato
          </p>
          <p className="mt-0.5 text-sm font-semibold tabular-nums text-amber-800">
            €{wastedEuro.toFixed(0)}
          </p>
        </div>
      </div>
    </div>
  );
}
