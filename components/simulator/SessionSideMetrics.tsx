"use client";

import { ArrowUpRight, EuroIcon, Gauge } from "lucide-react";
import { cn } from "@/app/utils/cn";

type SessionSideMetricsProps = {
  totalCost: number;
  budget?: number;
  patientStress: number;
  onOpenDischarge: () => void;
  reportReady?: boolean;
  className?: string;
};

/**
 * Side rail: cost / stress / referto CTA — fills available height in the clinical column.
 */
export function SessionSideMetrics({
  totalCost,
  budget = 250,
  patientStress,
  onOpenDischarge,
  reportReady = false,
  className,
}: SessionSideMetricsProps) {
  const costPct = Math.min(100, (totalCost / budget) * 100);
  const overBudget = totalCost > budget;
  const stress = Math.max(0, Math.min(100, Math.round(patientStress)));
  const stressTier = stress >= 80 ? "danger" : stress >= 50 ? "warning" : "calm";
  /** Soft slate-blue folder (same family as coaching blue). */
  const referto = {
    fill: "#E4EAF3",
    border: "#C5D0E0",
  };

  return (
    <div className={cn("flex min-h-0 w-full flex-col gap-2.5", className)}>
      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-3.5 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
              <EuroIcon className="h-4 w-4" strokeWidth={1.75} />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                Costo SSN
              </p>
              <p className="mt-0.5 text-lg font-bold tabular-nums leading-none text-slate-800">
                €{totalCost.toFixed(0)}
                <span className="ml-1 text-xs font-medium text-slate-400">/ {budget}</span>
              </p>
            </div>
          </div>
          <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${costPct}%`, backgroundColor: "#345884" }}
            />
          </div>
          {overBudget ? (
            <p className="mt-1.5 text-[10px] font-semibold text-slate-600">Over budget</p>
          ) : null}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-3.5 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
              <Gauge className="h-4 w-4" strokeWidth={1.75} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                Stress
              </p>
              <p className="mt-0.5 text-lg font-bold tabular-nums leading-none text-slate-800">
                {stress}%
              </p>
            </div>
          </div>
          <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${stress}%`, backgroundColor: "#345884" }}
            />
          </div>
          {stressTier !== "calm" ? (
            <p className="mt-1.5 text-[10px] font-medium text-slate-500">
              {stressTier === "danger" ? "Critico" : "In aumento"}
            </p>
          ) : null}
        </div>
      </div>

      <div className="relative min-h-0 pt-2">
        <span
          className="pointer-events-none absolute left-4 top-0 z-20 h-[11px] w-12 rounded-t-md border border-b-0"
          style={{
            backgroundColor: referto.fill,
            borderColor: referto.border,
          }}
          aria-hidden
        />
        <button
          type="button"
          onClick={onOpenDischarge}
          className="group relative z-10 flex w-full flex-col justify-between gap-3 overflow-hidden rounded-b-xl rounded-tr-xl border px-4 py-4 text-left transition hover:brightness-[0.985]"
          style={{
            backgroundColor: referto.fill,
            borderColor: referto.border,
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
              Chiusura caso
            </p>
            <ArrowUpRight
              className="h-4 w-4 text-slate-500 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-[#0e3b68]"
              strokeWidth={1.75}
            />
          </div>

          <div>
            <p className="font-display text-lg font-semibold tracking-tight text-[#1E324E]">
              Referto di dimissione
            </p>
            <p className="mt-1 max-w-[18rem] text-[12px] leading-snug text-slate-600">
              {reportReady
                ? "Bozza completa — apri per rivedere e confermare."
                : "Redigi anamnesi, riscontri e diagnosi di dimissione."}
            </p>
          </div>

          <p className="text-[11px] font-semibold text-[#00B4D8] underline-offset-2 group-hover:underline">
            {reportReady ? "Apri referto" : "Inizia compilazione"}
          </p>
        </button>
      </div>
    </div>
  );
}
