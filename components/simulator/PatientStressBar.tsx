"use client";

import { useState } from "react";
import { Gauge, Info } from "lucide-react";
import { cn } from "@/app/utils/cn";
import { PRASSI_TONE } from "@/lib/ui/prassi-pastels";
import { isCriticalPatientStress } from "@/lib/simulator/patient-stress-engine";

type PatientStressBarProps = {
  value: number;
  className?: string;
  /** High-urgency pulse when patientStress is at or past 80. */
  critical?: boolean;
  /** One line: last event, or the case baseline label. */
  caption?: string;
  /** Last change. Stays next to the caption so the student can read the impact. */
  delta?: number | null;
  /** Non-spoiler note about what this patient reacts to. */
  coach?: string;
};

function tierOf(value: number): "calm" | "warning" | "danger" {
  if (isCriticalPatientStress(value)) return "danger";
  if (value >= 50) return "warning";
  return "calm";
}

const TIER_LABEL = {
  calm: "Calmo",
  warning: "In tensione",
  danger: "Critico",
} as const;

/** Barra 0–100: palette cartelle Prassi, con il motivo dell'ultimo cambio. */
export function PatientStressBar({
  value,
  className,
  critical = false,
  caption,
  delta,
  coach,
}: PatientStressBarProps) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  const tier = tierOf(v);
  const tone =
    tier === "danger" ? PRASSI_TONE.blush : tier === "warning" ? PRASSI_TONE.peach : PRASSI_TONE.blue;
  const [coachOpen, setCoachOpen] = useState(false);
  const shownDelta = delta != null && delta !== 0 ? Math.round(delta) : null;

  return (
    <div className={className ?? ""}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-600">
          <Gauge className="h-3.5 w-3.5 shrink-0 text-slate-500" />
          Stress / urgenza
          {coach ? (
            <button
              type="button"
              className="rounded-full p-0.5 text-slate-400 hover:text-slate-600"
              aria-label="Come reagisce questo paziente"
              aria-expanded={coachOpen}
              onClick={() => setCoachOpen((open) => !open)}
            >
              <Info className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="rounded-full px-1.5 py-0.5 text-[10px] font-medium"
            style={{ color: tone.accent, backgroundColor: tone.fill }}
          >
            {TIER_LABEL[tier]}
          </span>
          <span
            className={cn(
              "text-[11px] font-semibold tabular-nums",
              (critical || tier === "danger") && "animate-pulse motion-reduce:animate-none",
            )}
            style={{ color: tone.accent }}
          >
            {v}%
          </span>
        </span>
      </div>
      <div
        className="h-2.5 w-full overflow-hidden rounded-full border shadow-inner"
        style={{ backgroundColor: tone.fill, borderColor: tone.border }}
      >
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{ width: `${v}%`, backgroundColor: tone.accent }}
          role="progressbar"
          aria-valuenow={v}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Stress paziente ${v} percento`}
        />
      </div>
      {caption ? (
        <p className="mt-1.5 flex items-center gap-1.5 text-[10px] leading-snug text-slate-500">
          {shownDelta != null ? (
            <span
              className={cn(
                "shrink-0 font-semibold tabular-nums",
                shownDelta < 0 ? "text-emerald-700" : "text-red-600",
              )}
            >
              {shownDelta > 0 ? `+${shownDelta}` : shownDelta}
            </span>
          ) : null}
          <span className="line-clamp-1">{caption}</span>
        </p>
      ) : null}
      {coachOpen && coach ? (
        <p className="mt-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-[10px] leading-snug text-slate-600">
          {coach}
        </p>
      ) : null}
    </div>
  );
}
