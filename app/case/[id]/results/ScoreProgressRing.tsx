"use client";

import type { ReactNode } from "react";
import { cn } from "@/app/utils/cn";

type ScoreProgressRingProps = {
  score: number;
  label: string;
  size?: number;
  className?: string;
  /** Optional icon rendered above the ring (plancia 5 pilastri). */
  icon?: ReactNode;
  /** Compact mode for dense 5-column layouts. */
  compact?: boolean;
};

export function ScoreProgressRing({
  score,
  label,
  size = 132,
  className,
  icon,
  compact = false,
}: ScoreProgressRingProps) {
  const clamped = Math.max(0, Math.min(100, score));
  const radius = compact ? 36 : 42;
  const strokeWidth = compact ? 7 : 8;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;
  const resolvedSize = compact ? Math.min(size, 108) : size;

  return (
    <div className={cn("flex flex-col items-center gap-2.5", className)}>
      {icon ? (
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-secondary/10 text-brand-secondary">
          {icon}
        </div>
      ) : null}
      <div className="relative" style={{ width: resolvedSize, height: resolvedSize }}>
        <svg
          width={resolvedSize}
          height={resolvedSize}
          viewBox="0 0 100 100"
          className="-rotate-90"
          aria-hidden
        >
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="#E2E8F0"
            strokeWidth={strokeWidth}
          />
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="#345884"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className={cn(
              "font-display font-bold tabular-nums text-brand-primary",
              compact ? "text-lg" : "text-3xl",
            )}
          >
            {Math.round(clamped)}%
          </span>
        </div>
      </div>
      <p
        className={cn(
          "text-center font-medium leading-snug text-slate-500",
          compact ? "max-w-[7.5rem] text-[10px]" : "max-w-[9rem] text-xs",
        )}
      >
        {label}
      </p>
    </div>
  );
}
