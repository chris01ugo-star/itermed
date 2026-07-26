"use client";

import { Lightbulb } from "lucide-react";
import { cn } from "@/app/utils/cn";
import { PRASSI_TONE } from "@/lib/ui/prassi-pastels";

type LiveCoachingPanelProps = {
  score: number;
  metrics: Array<{ label: string; value: number; tone?: "good" | "warn" | "risk" }>;
  tip?: string;
  className?: string;
};

const COACHING_BLUE = "#345884";

export function LiveCoachingPanel({
  score,
  metrics,
  tip,
  className,
}: LiveCoachingPanelProps) {
  const clamped = Math.max(0, Math.min(100, score));
  const circumference = 2 * Math.PI * 32;
  const offset = circumference * (1 - clamped / 100);
  const track = "#E8ECF1";

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm",
        className,
      )}
    >
      <div className="border-b border-slate-100 px-4 py-3">
        <p className="text-sm font-semibold text-slate-800">Coaching in tempo reale</p>
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
              stroke={COACHING_BLUE}
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-lg font-bold tabular-nums leading-none text-slate-800">
              {clamped}
            </span>
            <span className="mt-0.5 text-[10px] text-slate-400">/100</span>
          </div>
        </div>

        <div className="min-w-0 flex-1 divide-y divide-slate-100">
          {metrics.map((m) => (
            <div key={m.label} className="py-2 first:pt-0 last:pb-0">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="truncate text-[13px] text-slate-600">{m.label}</span>
                <span className="shrink-0 text-[11px] font-semibold tabular-nums text-slate-500">
                  {Math.round(m.value)}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full transition-[width]"
                  style={{
                    width: `${Math.max(0, Math.min(100, m.value))}%`,
                    backgroundColor: COACHING_BLUE,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {tip ? (
        <div
          className="border-t border-slate-100 px-4 py-3"
          style={{ backgroundColor: `${PRASSI_TONE.blue.fill}B3` }}
        >
          <div className="flex items-start gap-2">
            <Lightbulb
              className="mt-0.5 h-3.5 w-3.5 shrink-0"
              style={{ color: PRASSI_TONE.blue.accent }}
              strokeWidth={1.75}
            />
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                Suggerimento
              </p>
              <p className="mt-0.5 text-sm leading-relaxed text-slate-600">{tip}</p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
