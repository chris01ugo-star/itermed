"use client";

import {
  deriveDemoVitals,
  estimateAgeFromTitle,
  patientDisplayName,
} from "@/lib/prassi/demo-vitals";
import {
  classifyVitals,
  maxVitalStatus,
  vitalFindingLabel,
  vitalStatusLabel,
  type VitalStatus,
} from "@/lib/clinical/vital-status";
import { cn } from "@/app/utils/cn";
import { PRASSI_TONE } from "@/lib/ui/prassi-pastels";
import {
  Activity,
  Droplets,
  Heart,
  Thermometer,
  Wind,
  type LucideIcon,
} from "lucide-react";

type VitalSignsBoardProps = {
  caseId: string;
  title?: string | null;
  age?: number | string | null;
  sex?: string | null;
  stress?: number;
  className?: string;
  showHeader?: boolean;
};

const VITAL_ICONS: Record<string, LucideIcon> = {
  hr: Heart,
  bp: Activity,
  spo2: Droplets,
  rr: Wind,
  temp: Thermometer,
};

/** Same red as Termina caso / Paziente instabile. */
const ALERT_RED = PRASSI_TONE.blush.accent;

function findingColor(status: VitalStatus): string {
  if (status === "stable") return "#94A3B8";
  return ALERT_RED;
}

export function VitalSignsBoard({
  caseId,
  title,
  age,
  sex,
  stress = 0,
  className,
  showHeader = true,
}: VitalSignsBoardProps) {
  const vitals = deriveDemoVitals(caseId, stress);
  const classified = classifyVitals(vitals);
  const overall = maxVitalStatus(classified.map((v) => v.status));
  const resolvedAge = typeof age === "number" ? age : estimateAgeFromTitle(title, Number(age) || 58);
  const name = patientDisplayName(caseId, title, sex);
  const sexLabel = sex === "F" ? "F" : sex === "M" ? "M" : null;
  const unstable = overall !== "stable";

  return (
    <div
      className={cn(
        "w-full min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm",
        className,
      )}
      role="region"
      aria-label="Monitor parametri vitali"
    >
      {showHeader ? (
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-800">
              {name}
              <span className="font-normal text-slate-400">
                {" "}
                · {resolvedAge} anni
                {sexLabel ? ` · ${sexLabel}` : ""}
              </span>
            </p>
          </div>
          <span
            className="inline-flex shrink-0 items-center rounded-lg px-2.5 py-1 text-xs font-semibold uppercase tracking-wide"
            style={
              unstable
                ? {
                    backgroundColor: PRASSI_TONE.blush.fill,
                    color: ALERT_RED,
                    border: `1px solid ${PRASSI_TONE.blush.border}`,
                  }
                : {
                    backgroundColor: "#F1F5F9",
                    color: "#64748B",
                    border: "1px solid #E2E8F0",
                  }
            }
          >
            {unstable ? "Instabile" : vitalStatusLabel(overall)}
          </span>
        </div>
      ) : null}

      <div className="grid grid-cols-2 divide-y divide-slate-200/80 sm:grid-cols-3 sm:divide-y-0 sm:divide-x lg:grid-cols-5">
        {classified.map((vital) => {
          const Icon = VITAL_ICONS[vital.id] ?? Activity;
          const finding = vitalFindingLabel(vital).toUpperCase();
          const alert = vital.status !== "stable";
          return (
            <div
              key={vital.id}
              className="flex min-w-0 flex-col gap-1 px-4 py-3.5"
              title={`${vital.fullLabel}: ${vital.value} ${vital.unit}`}
            >
              <div className="flex items-center gap-1.5">
                <Icon
                  className="h-4 w-4 shrink-0"
                  strokeWidth={1.75}
                  style={{ color: alert ? ALERT_RED : "#475569" }}
                />
                <span className="text-sm font-semibold text-slate-700">{vital.label}</span>
              </div>
              <p className="text-2xl font-bold tabular-nums leading-none text-slate-900 md:text-[1.75rem]">
                {vital.value}
                {vital.id === "spo2" ? <span className="text-lg">%</span> : null}
              </p>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                {vital.id === "spo2" ? "aria ambiente" : vital.unit}
              </p>
              <p
                className="text-xs font-bold uppercase tracking-wide"
                style={{ color: findingColor(vital.status) }}
              >
                {finding}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
