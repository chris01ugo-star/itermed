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
    <div
      role="note"
      aria-label="Avviso: caso clinico simulato ad uso didattico"
      className={cn(
        "flex items-start gap-2 rounded-lg border border-slate-100 bg-slate-50/80 px-2.5 py-2",
        className,
      )}
    >
      <AlertTriangle
        className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500/80"
        strokeWidth={2}
        aria-hidden
      />
      <div className="min-w-0 space-y-0.5 text-[10px] leading-snug text-slate-500 sm:text-[11px]">
        <p className="font-medium text-slate-600">
          Caso clinico simulato ad esclusivo uso didattico.
        </p>
        <p>
          Non utilizzare per decisioni su pazienti reali né come dispositivo medico.
        </p>
      </div>
    </div>
  );
}
