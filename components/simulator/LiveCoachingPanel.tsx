"use client";

import { Lightbulb, ShieldAlert } from "lucide-react";
import { cn } from "@/app/utils/cn";
import type { LiveCoachingMetric } from "@/lib/simulator/live-coaching-estimate";

type LiveCoachingPanelProps = {
  /**
   * Weighted 0–100 after first interaction.
   * `null` at Minuto 0 → hero shows "--" / Inizio simulazione.
   */
  scorePercent: number | null;
  /** Official-scale equivalent; null while baseline. */
  scoreTrentesimi: number | null;
  isBaseline?: boolean;
  metrics: LiveCoachingMetric[];
  tip?: string;
  unstable?: boolean;
  /** When false, tip is omitted (render ClinicalNudgeBanner elsewhere). */
  showTip?: boolean;
  className?: string;
};

const MEDICAL_BLUE = "#345884";

const TONE_BAR: Record<NonNullable<LiveCoachingMetric["tone"]>, string> = {
  good: MEDICAL_BLUE,
  warn: "#C4872A",
  risk: "#B42318",
};

type ClinicalNudgeBannerProps = {
  tip: string;
  unstable?: boolean;
  className?: string;
};

export function ClinicalNudgeBanner({
  tip,
  unstable = false,
  className,
}: ClinicalNudgeBannerProps) {
  return (
    <div
      className={cn(
        "rounded-xl border px-3.5 py-3",
        unstable
          ? "border-amber-200/90 bg-amber-50/90"
          : "border-slate-200 bg-[#EEF2F9]",
        className,
      )}
      role="status"
    >
      <div className="flex items-start gap-2.5">
        {unstable ? (
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" strokeWidth={1.75} />
        ) : (
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-[#345884]" strokeWidth={1.75} />
        )}
        <div className="min-w-0 space-y-0.5">
          <p
            className={cn(
              "text-[11px] font-semibold tracking-wide",
              unstable ? "text-amber-800" : "text-[#345884]",
            )}
          >
            {unstable ? "Suggerimento · paziente instabile" : "Suggerimento clinico"}
          </p>
          <p className="text-sm leading-relaxed text-slate-700">{tip}</p>
        </div>
      </div>
    </div>
  );
}

export function LiveCoachingPanel({
  scorePercent,
  scoreTrentesimi,
  isBaseline = scorePercent === null,
  metrics,
  tip,
  unstable = false,
  showTip = true,
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
  const track = "#E8EEF5";
  const ringColor = isBaseline || !hasScore ? "#94A3B8" : MEDICAL_BLUE;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3.5">
        <p className="text-sm font-semibold text-slate-800">Coaching in tempo reale</p>
        <p className="text-[11px] font-medium text-slate-400">
          {isBaseline ? "Minuto 0" : "Live"}
        </p>
      </div>

      <div className="flex items-start gap-5 px-4 py-5">
        <div className="relative flex h-[4.75rem] w-[4.75rem] shrink-0 items-center justify-center">
          <svg className="h-full w-full -rotate-90" viewBox="0 0 72 72" aria-hidden>
            <circle cx="36" cy="36" r="32" fill="none" stroke={track} strokeWidth="6" />
            <circle
              cx="36"
              cy="36"
              r="32"
              fill="none"
              stroke={ringColor}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center px-1 text-center">
            {hasScore ? (
              <>
                <span className="text-lg font-bold tabular-nums leading-none text-slate-800">
                  {clamped100}
                </span>
                <span className="mt-0.5 text-[10px] font-medium text-slate-400">/100</span>
              </>
            ) : (
              <>
                <span className="text-xl font-semibold leading-none text-slate-300">—</span>
                <span className="mt-1 max-w-[4.5rem] text-[10px] font-medium leading-tight text-slate-400">
                  Inizio
                </span>
              </>
            )}
          </div>
        </div>

        <div className="min-w-0 flex-1 space-y-3.5">
          <p className="text-xs text-slate-500">
            {hasScore && clamped30 != null
              ? `Equiv. ${clamped30 % 1 === 0 ? clamped30.toFixed(0) : clamped30.toFixed(1)}/30 · pesi 30/30/20/20`
              : "Sessione avviata · in attesa di azioni"}
          </p>

          <div className="space-y-3">
            {metrics.map((m) => {
              const barColor = TONE_BAR[m.tone ?? "good"];
              const awaitingAnamnesis = m.id === "clinical" && m.value === 0;
              const safetyAlert = m.id === "legal" && m.value <= 40 && m.tone === "risk";
              const pct = Math.max(0, Math.min(100, m.value));

              return (
                <div key={m.id} className="space-y-1.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-[13px] font-medium text-slate-700">
                      {m.label}
                    </span>
                    <span
                      className={cn(
                        "shrink-0 text-[12px] font-semibold tabular-nums text-slate-600",
                        awaitingAnamnesis && "text-slate-400",
                      )}
                    >
                      {Math.round(m.value)}
                      <span className="font-normal text-slate-400">/100</span>
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full transition-[width] duration-500 ease-out"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: barColor,
                        opacity: awaitingAnamnesis ? 0.35 : 1,
                      }}
                    />
                  </div>
                  {m.statusLabel ? (
                    <p
                      className={cn(
                        "text-[11px] leading-snug text-slate-500",
                        safetyAlert && "text-amber-800",
                        awaitingAnamnesis && "text-slate-400",
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

      {showTip && tip ? (
        <div className="border-t border-slate-100 px-3 pb-3 pt-3">
          <ClinicalNudgeBanner tip={tip} unstable={unstable} />
        </div>
      ) : null}
    </div>
  );
}
