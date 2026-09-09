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
        "px-1 text-[10px] leading-snug text-slate-400 sm:text-[11px]",
        className,
      )}
    >
      Caso clinico simulato · solo uso didattico · non per decisioni su pazienti reali
    </p>
  );
}
