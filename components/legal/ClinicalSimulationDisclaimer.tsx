import { AlertTriangle } from "lucide-react";
import { cn } from "@/app/utils/cn";

export const CLINICAL_SIMULATION_DISCLAIMER =
  "Caso clinico simulato ad esclusivo uso didattico. Non utilizzare per decisioni su pazienti reali né come dispositivo medico.";

type ClinicalSimulationDisclaimerProps = {
  className?: string;
};

/**
 * Permanent, discreet educational-use notice for the live patient chat surface.
 */
export function ClinicalSimulationDisclaimer({ className }: ClinicalSimulationDisclaimerProps) {
  return (
    <p
      role="note"
      aria-label="Avviso: caso clinico simulato ad uso didattico"
      className={cn(
        "flex items-start gap-1.5 px-0.5 text-[10px] leading-snug text-slate-400 sm:text-[11px]",
        className,
      )}
    >
      <AlertTriangle
        className="mt-0.5 h-3 w-3 shrink-0 text-amber-500/80"
        strokeWidth={2}
        aria-hidden
      />
      <span className="min-w-0">{CLINICAL_SIMULATION_DISCLAIMER}</span>
    </p>
  );
}
