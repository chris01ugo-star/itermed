type OverviewHeroProps = {
  userName?: string | null;
  completedCount: number;
  casesThisWeek: number;
  focusLabel: string;
};

export function OverviewHero({
  userName,
  completedCount,
  casesThisWeek,
  focusLabel,
}: OverviewHeroProps) {
  const firstName = userName?.split(" ")[0];
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Buongiorno" : hour < 18 ? "Buon pomeriggio" : "Buonasera";

  return (
    <header className="space-y-1.5">
      <h1 className="font-display text-[28px] font-bold tracking-tight text-text-primary">
        {greeting}
        {firstName ? `, ${firstName}` : ""}.
      </h1>
      <p className="text-sm leading-relaxed text-slate-500">
        {completedCount > 0 ? (
          <>
            Questa settimana: {casesThisWeek} {casesThisWeek === 1 ? "caso" : "casi"}. Focus
            consigliato: <span className="font-medium text-slate-700">{focusLabel}</span>.
          </>
        ) : (
          <>Inizia dalla Prassi Clinica: scegli un caso e avvia la simulazione.</>
        )}
      </p>
    </header>
  );
}
