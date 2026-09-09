"use client";

import { cn } from "@/app/utils/cn";
import {
  computeEfficiencyPercent,
  computeScostamentoPercent,
} from "@/lib/services/evaluation-economy-ssn";

type EconomicBudgetGaugeProps = {
  /** Spesa ideale Gold Standard (€) — preferita rispetto al solo budget sessione. */
  targetBudget: number;
  actualSpent: number;
  wastedEuro?: number;
  /** Optional precomputed efficiency [0,100]; else derived safely. */
  efficiencyPercent?: number;
  /** Optional precomputed scostamento [0,100]. */
  scostamentoPercent?: number;
  deltaSpendEuro?: number;
  className?: string;
};

export function EconomicBudgetGauge({
  targetBudget,
  actualSpent,
  wastedEuro = 0,
  efficiencyPercent,
  scostamentoPercent,
  deltaSpendEuro,
  className,
}: EconomicBudgetGaugeProps) {
  const safeTarget = Number.isFinite(targetBudget) ? Math.max(0, targetBudget) : 0;
  const safeSpent = Number.isFinite(actualSpent) ? Math.max(0, actualSpent) : 0;
  const safeWaste = Number.isFinite(wastedEuro) ? Math.max(0, wastedEuro) : 0;
  const delta =
    typeof deltaSpendEuro === "number" && Number.isFinite(deltaSpendEuro)
      ? deltaSpendEuro
      : safeSpent - safeTarget;

  const efficiency =
    typeof efficiencyPercent === "number" && Number.isFinite(efficiencyPercent)
      ? Math.max(0, Math.min(100, Math.round(efficiencyPercent)))
      : computeEfficiencyPercent(safeSpent, safeTarget);

  const scostamento =
    typeof scostamentoPercent === "number" && Number.isFinite(scostamentoPercent)
      ? Math.max(0, Math.min(100, Math.round(scostamentoPercent)))
      : computeScostamentoPercent(safeSpent, safeTarget);

  const ratio = safeTarget > 0 ? Math.min(safeSpent / safeTarget, 1.5) : safeSpent > 0 ? 1.5 : 0;
  const fillPercent = Math.min(100, ratio * 100);
  const isOver = safeSpent > safeTarget && safeTarget > 0;
  const isWarning = ratio > 0.85 && !isOver && safeTarget > 0;

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
            Spesa effettiva vs ideale GS
          </p>
          <p className="mt-1 font-display text-2xl font-semibold tracking-tight text-text-primary tabular-nums">
            €{safeSpent.toFixed(0)}
            <span className="text-sm font-normal text-slate-500">
              {" "}
              / €{safeTarget.toFixed(0)}
            </span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-medium text-slate-500">Efficienza prescrittiva</p>
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
            {efficiency}%
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

      <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
        <div className="rounded-xl border border-border bg-ui-bg/60 px-2 py-2.5">
          <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-500">
            Spesa totale
          </p>
          <p className="mt-0.5 text-sm font-semibold tabular-nums text-brand-primary">
            €{safeSpent.toFixed(0)}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-ui-bg/60 px-2 py-2.5">
          <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-500">
            Spesa ideale
          </p>
          <p className="mt-0.5 text-sm font-semibold tabular-nums text-brand-secondary">
            €{safeTarget.toFixed(0)}
          </p>
        </div>
        <div
          className={cn(
            "rounded-xl border px-2 py-2.5",
            delta > 0 ? "border-rose-200/80 bg-rose-50/80" : "border-border bg-ui-bg/60",
          )}
        >
          <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-500">
            Delta spesa
          </p>
          <p
            className={cn(
              "mt-0.5 text-sm font-semibold tabular-nums",
              delta > 0 ? "text-status-risk" : "text-brand-secondary",
            )}
          >
            {delta >= 0 ? "+" : ""}€{delta.toFixed(0)}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-ui-bg/60 px-2 py-2.5">
          <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-500">
            Scostamento
          </p>
          <p className="mt-0.5 text-sm font-semibold tabular-nums text-amber-800">
            {scostamento}%
          </p>
        </div>
      </div>

      {safeWaste > 0 ? (
        <p className="text-[11px] text-amber-800">
          Spreco stimato (inappropriate): €{safeWaste.toFixed(2)}
        </p>
      ) : null}
    </div>
  );
}
