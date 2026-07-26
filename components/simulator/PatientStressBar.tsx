"use client";

import { AlertTriangle, Gauge } from "lucide-react";
import { PRASSI_TONE } from "@/lib/ui/prassi-pastels";

type PatientStressBarProps = {
  value: number;
  className?: string;
};

/** Barra 0–100: palette cartelle Prassi (blue / peach / blush). */
export function PatientStressBar({ value, className }: PatientStressBarProps) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  const tier = v >= 80 ? "danger" : v >= 50 ? "warning" : "calm";
  const tone =
    tier === "danger"
      ? PRASSI_TONE.blush
      : tier === "warning"
        ? PRASSI_TONE.peach
        : PRASSI_TONE.blue;

  return (
    <div className={className ?? ""}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-600">
          <Gauge className="h-3.5 w-3.5 shrink-0 text-slate-500" />
          Stress / urgenza
        </span>
        <span className="text-[11px] font-semibold tabular-nums" style={{ color: tone.accent }}>
          {v}%
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
      {tier !== "calm" && (
        <p
          className="mt-1.5 inline-flex items-center gap-1 text-[10px]"
          style={{ color: tone.accent }}
        >
          <AlertTriangle className="h-3 w-3 shrink-0" />
          {tier === "danger"
            ? "Situazione critica: il paziente è molto instabile."
            : "Attenzione: pressione temporale e disagio in aumento."}
        </p>
      )}
    </div>
  );
}
