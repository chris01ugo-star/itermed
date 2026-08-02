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

const MEDICAL_BLUE = "#0e3b68";

function findingColor(status: VitalStatus): string {
  if (status === "stable") return "#94A3B8";
  if (status === "borderline") return "#D97706";
  return "#DC2626";
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
  const critical = overall === "critical" || vitals.spo2 < 90 || vitals.hr > 110;

  return (
    <div
      className={cn(
        "w-full min-w-0 overflow-hidden rounded-xl border bg-white",
        critical
          ? "border-red-500/40 shadow-[inset_0_0_0_1px_rgba(239,68,68,0.12)]"
          : unstable
            ? "border-amber-500/40"
            : "border-slate-200",
        className,
      )}
      role="region"
      aria-label="Monitor parametri vitali"
    >
      {showHeader ? (
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 bg-slate-50 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">
              {name}
              <span className="font-normal text-slate-400">
                {" "}
                · {resolvedAge} anni
                {sexLabel ? ` · ${sexLabel}` : ""}
              </span>
            </p>
          </div>
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-mono uppercase tracking-wider",
              unstable
                ? "border border-red-500/40 bg-red-500/10 text-red-600"
                : "border border-slate-200 bg-white text-slate-500",
            )}
          >
            {unstable ? (
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
            ) : null}
            {unstable ? "Paziente instabile" : vitalStatusLabel(overall)}
          </span>
        </div>
      ) : null}

      <div className="grid grid-cols-2 divide-y divide-slate-200/80 sm:grid-cols-3 sm:divide-y-0 sm:divide-x lg:grid-cols-5">
        {classified.map((vital) => {
          const Icon = VITAL_ICONS[vital.id] ?? Activity;
          const finding = vitalFindingLabel(vital).toUpperCase();
          const alert = vital.status !== "stable";
          const isCriticalVital = vital.status === "critical";
          return (
            <div
              key={vital.id}
              className={cn(
                "flex min-w-0 flex-col gap-1 px-4 py-3.5 transition-colors",
                isCriticalVital && "bg-red-500/10",
                alert && !isCriticalVital && "bg-amber-500/5",
              )}
              title={`${vital.fullLabel}: ${vital.value} ${vital.unit}`}
            >
              <div className="flex items-center gap-1.5">
                <Icon
                  className={cn(
                    "h-4 w-4 shrink-0",
                    isCriticalVital && "animate-pulse",
                  )}
                  strokeWidth={1.75}
                  style={{ color: alert ? findingColor(vital.status) : MEDICAL_BLUE }}
                />
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
                  {vital.label}
                </span>
              </div>
              <p
                className={cn(
                  "text-2xl font-bold tabular-nums leading-none md:text-[1.75rem]",
                  isCriticalVital ? "text-red-600" : "text-slate-900",
                )}
              >
                {vital.value}
                {vital.id === "spo2" ? <span className="text-lg">%</span> : null}
              </p>
              <p className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                {vital.id === "spo2" ? "aria ambiente" : vital.unit}
              </p>
              <p
                className="text-[10px] font-mono font-semibold uppercase tracking-wider"
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
