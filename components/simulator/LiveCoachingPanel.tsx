"use client";

import { Lightbulb, ShieldAlert } from "lucide-react";
import { cn } from "@/app/utils/cn";
import type { LiveCoachingMetric } from "@/lib/simulator/live-coaching-estimate";

type LiveCoachingPanelProps = {
  /**
   * Weighted 0–100 after first interaction.
   * `null` at Minuto 0 → hero shows "--" / INIZIO SIMULAZIONE.
   */
  scorePercent: number | null;
  /** Official-scale equivalent; null while baseline. */
  scoreTrentesimi: number | null;
  isBaseline?: boolean;
  metrics: LiveCoachingMetric[];
  tip?: string;
  unstable?: boolean;
  className?: string;
};

const MEDICAL_BLUE = "#0e3b68";
const HIGHLIGHT = "#00B4D8";
const TONE_COLOR: Record<NonNullable<LiveCoachingMetric["tone"]>, string> = {
  good: MEDICAL_BLUE,
  warn: "#D97706",
  risk: "#DC2626",
};

export function LiveCoachingPanel({
  scorePercent,
  scoreTrentesimi,
  isBaseline = scorePercent === null,
  metrics,
  tip,
  unstable = false,
  className,
}: LiveCoachingPanelProps) {
  const hasScore = typeof scorePercent === "number" && Number.isFinite(scorePercent);
  const clamped100 = hasScore ? Math.max(0, Math.min(100, scorePercent)) : 0;
  const clamped30 =
    typeof scoreTrentesimi === "number" && Number.isFinite(scoreTrentesimi)
      ? Math.max(0, Math.min(30, scoreTrentesimi))
      : null;
  const circumference = 2 * Math.PI * 32;
  const offset = hasScore ? circumference * (1 - clamped100 / 100) : circumference;
  const track = "#E2E8F0";
  const ringColor =
    isBaseline || !hasScore
      ? "#94A3B8"
      : unstable && clamped100 < 55
        ? TONE_COLOR.risk
        : MEDICAL_BLUE;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-slate-200 bg-white",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 bg-slate-50 px-4 py-3">
        <p className="text-sm font-semibold text-slate-900">Coaching in tempo reale</p>
        <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
          {isBaseline ? "State · minuto 0" : "Macro-aree · live"}
        </p>
      </div>

      <div className="flex items-center gap-5 px-4 py-4">
        <div className="relative flex h-[4.5rem] w-[4.5rem] shrink-0 items-center justify-center">
          <svg className="h-full w-full -rotate-90" viewBox="0 0 72 72" aria-hidden>
            <circle cx="36" cy="36" r="32" fill="none" stroke={track} strokeWidth="5" />
            <circle
              cx="36"
              cy="36"
              r="32"
              fill="none"
              stroke={ringColor}
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center px-1 text-center">
            {hasScore ? (
              <>
                <span className="text-lg font-bold tabular-nums leading-none text-slate-900">
                  {clamped100}
                </span>
                <span className="mt-0.5 text-[10px] font-mono uppercase tracking-wider text-slate-500">
                  /100
                </span>
              </>
            ) : (
              <>
                <span className="text-xl font-bold leading-none text-slate-400">--</span>
                <span className="mt-1 max-w-[4.25rem] text-[8px] font-mono uppercase leading-tight tracking-wider text-slate-500">
                  Inizio simulazione
                </span>
              </>
            )}
          </div>
        </div>

        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="mb-1.5 text-[10px] font-mono uppercase tracking-wider text-slate-500">
            {hasScore && clamped30 != null
              ? `Equiv. ${clamped30 % 1 === 0 ? clamped30.toFixed(0) : clamped30.toFixed(1)}/30 · pesi 30/30/20/20`
              : "Sessione avviata · in attesa di azioni"}
          </p>
          <div className="divide-y divide-slate-100">
            {metrics.map((m) => {
              const barColor = TONE_COLOR[m.tone ?? "good"];
              const awaitingAnamnesis = m.id === "clinical" && m.value === 0;
              const safetyAlert = m.id === "legal" && m.value <= 40 && m.tone === "risk";
              return (
                <div key={m.id} className="py-2 first:pt-0 last:pb-0">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span
                      className={cn(
                        "truncate text-[13px] font-medium",
                        safetyAlert ? "text-red-700" : "text-slate-700",
                      )}
                    >
                      {m.label}
                    </span>
                    <span
                      className={cn(
                        "shrink-0 text-[11px] font-semibold tabular-nums",
                        awaitingAnamnesis
                          ? "text-amber-700"
                          : safetyAlert
                            ? "text-red-600"
                            : "text-slate-600",
                      )}
                    >
                      {Math.round(m.value)}
                      <span className="font-normal text-slate-400">/100</span>
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-sm bg-slate-100">
                    <div
                      className="h-full rounded-sm transition-[width]"
                      style={{
                        width: `${Math.max(0, Math.min(100, m.value))}%`,
                        backgroundColor: barColor,
                      }}
                    />
                  </div>
                  {m.statusLabel ? (
                    <p
                      className={cn(
                        "mt-1 text-[9px] font-mono uppercase tracking-wider",
                        safetyAlert
                          ? "text-red-600"
                          : awaitingAnamnesis
                            ? "text-amber-700"
                            : "text-slate-400",
                      )}
                    >
                      {m.statusLabel}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {tip ? (
        <div
          className={cn(
            "mx-3 mb-3 rounded-md px-3 py-2.5",
            unstable
              ? "border-l-4 border-amber-500 bg-amber-500/10"
              : "border-l-4 border-[#0e3b68] bg-blue-500/10",
          )}
          role="status"
        >
          <div className="flex items-start gap-2">
            {unstable ? (
              <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" strokeWidth={1.75} />
            ) : (
              <Lightbulb
                className="mt-0.5 h-3.5 w-3.5 shrink-0"
                style={{ color: HIGHLIGHT }}
                strokeWidth={1.75}
              />
            )}
            <div className="min-w-0">
              <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
                {unstable ? "Clinical nudge · instabile" : "Clinical nudge"}
              </p>
              <p className="mt-0.5 text-sm leading-relaxed text-slate-700">{tip}</p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
