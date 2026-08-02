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
 * Side rail: neutral cost/stress cards + typography-led referto CTA (no toy icon tile).
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
    <div className={cn("flex h-full min-h-0 flex-col gap-3", className)}>
      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
              <EuroIcon className="h-5 w-5" strokeWidth={1.75} />
            </span>
            <div>
              <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
                Costo SSN
              </p>
              <p className="mt-0.5 text-2xl font-bold tabular-nums leading-none text-slate-800">
                €{totalCost.toFixed(0)}
                <span className="ml-1.5 text-sm font-medium text-slate-400">/ {budget}</span>
              </p>
            </div>
          </div>
          {overBudget ? (
            <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
              Over
            </span>
          ) : null}
        </div>
        <div className="mt-3.5 h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${costPct}%`, backgroundColor: "#0e3b68" }}
          />
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
            <Gauge className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
                Stress paziente
              </p>
              <p className="text-2xl font-bold tabular-nums leading-none text-slate-800">
                {stress}%
              </p>
            </div>
            <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${stress}%`, backgroundColor: "#0e3b68" }}
              />
            </div>
          </div>
        </div>
        {stressTier !== "calm" ? (
          <p className="mt-2.5 text-xs font-medium text-slate-500">
            {stressTier === "danger"
              ? "Situazione critica — paziente molto instabile"
              : "Pressione temporale e disagio in aumento"}
          </p>
        ) : null}
      </div>

      {/* Referto — folder with bordered tab */}
      <div className="relative mt-auto min-h-0 flex-1 pt-2.5">
        {/* Linguetta: bordo su tre lati, si innesta sul bordo superiore del box */}
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
          className="group relative z-10 flex h-full min-h-[9rem] w-full flex-col justify-between overflow-hidden rounded-b-2xl rounded-tr-2xl border px-4 py-4 text-left transition hover:brightness-[0.985]"
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
            <p className="font-display text-xl font-semibold tracking-tight text-[#0e3b68]">
              Referto di dimissione
            </p>
            <p className="mt-1.5 max-w-[16rem] text-[13px] leading-snug text-slate-600">
              {reportReady
                ? "Bozza completa — apri per rivedere e confermare la diagnosi."
                : "Redigi anamnesi, riscontri e diagnosi di dimissione per chiudere il caso."}
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
