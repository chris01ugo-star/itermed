import type { ElementType } from "react";
import { Award, Flame, Target } from "lucide-react";

type OverviewHeroProps = {
  userName?: string | null;
  completedCount: number;
  casesThisWeek: number;
  focusLabel: string;
  iterMedScore: number | null;
  focusShort: string;
  streakDays: number;
};

function StatChip({
  icon: Icon,
  label,
  value,
}: {
  icon: ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-[7.5rem] items-center gap-2.5 rounded-xl border border-border bg-ui-bg/80 px-3.5 py-2.5">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-slate-600 shadow-sm">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
        <p className="truncate text-sm font-semibold tabular-nums text-text-primary">{value}</p>
      </div>
    </div>
  );
}

export function OverviewHero({
  userName,
  completedCount,
  casesThisWeek,
  focusLabel,
  iterMedScore,
  focusShort,
  streakDays,
}: OverviewHeroProps) {
  const firstName = userName?.split(" ")[0];
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Buongiorno" : hour < 18 ? "Buon pomeriggio" : "Buonasera";

  return (
    <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="max-w-xl space-y-1.5">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-text-primary">
          {greeting}
          {firstName ? `, ${firstName}` : ""}.
        </h1>
        <p className="text-sm leading-relaxed text-slate-500">
          {completedCount > 0 ? (
            <>
              Questa settimana: {casesThisWeek}{" "}
              {casesThisWeek === 1 ? "caso" : "casi"}. Focus consigliato:{" "}
              <span className="font-medium text-slate-700">{focusLabel}</span>.
            </>
          ) : (
            <>Inizia dalla Prassi Clinica: scegli un caso e avvia la simulazione.</>
          )}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <StatChip
          icon={Award}
          label="Score"
          value={iterMedScore != null ? String(iterMedScore) : "—"}
        />
        <StatChip icon={Target} label="Focus" value={completedCount > 0 ? focusShort : "—"} />
        <StatChip icon={Flame} label="Streak" value={`${streakDays}g`} />
      </div>
    </header>
  );
}
