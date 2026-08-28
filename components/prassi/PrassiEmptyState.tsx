import type { ElementType } from "react";
import {
  ClipboardCheck,
  FolderOpen,
  MessageSquare,
  Pill,
  Stethoscope,
  Target,
} from "lucide-react";

export type PrassiWelcomeStats = {
  casesThisWeek: number;
  averageScore: number | null;
  focusShort: string;
};

type PrassiWelcomeDashboardProps = {
  stats?: PrassiWelcomeStats;
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
    <div className="flex min-w-0 items-center gap-3 rounded-xl border border-border bg-ui-bg/60 px-3.5 py-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-panel-bg text-brand-secondary shadow-sm ring-1 ring-border-subtle">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] text-slate-500">{label}</p>
        <p className="truncate text-sm font-semibold tabular-nums text-text-primary">{value}</p>
      </div>
    </div>
  );
}

const STEPS = [
  {
    icon: FolderOpen,
    title: "Apri una cartella",
    body: "Scegli un paziente nella lista a sinistra.",
  },
  {
    icon: Stethoscope,
    title: "Leggi il brief",
    body: "Controlla specialità, difficoltà e parametri vitali.",
  },
  {
    icon: MessageSquare,
    title: "Avvia e dialoga",
    body: "Parla col paziente, richiedi esami e chiudi il caso.",
  },
] as const;

export function PrassiWelcomeDashboard({ stats }: PrassiWelcomeDashboardProps) {
  const casesThisWeek = stats?.casesThisWeek ?? 0;
  const averageScore =
    stats?.averageScore != null ? Math.round(stats.averageScore) : null;
  const focusShort = stats?.focusShort?.trim() || "Appropriatezza prescrittiva";

  return (
    <div className="flex h-full min-h-0 flex-col justify-center gap-8 py-2">
      <div className="mx-auto w-full max-w-xl space-y-3 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-secondary">
          Pronto a esercitarti
        </p>
        <h2 className="font-display text-[1.55rem] font-bold tracking-tight text-text-primary md:text-[1.7rem]">
          Scegli una cartella a sinistra
        </h2>
        <p className="mx-auto max-w-md text-sm leading-relaxed text-slate-500">
          Ogni cartella è un caso clinico completo: anamnesi, esami, tutela
          medico-legale e budget SSN. Tocca una cartella per vedere il brief e
          partire.
        </p>
      </div>

      <ol className="mx-auto grid w-full max-w-xl grid-cols-1 gap-3 sm:grid-cols-3">
        {STEPS.map((step, index) => {
          const Icon = step.icon;
          return (
            <li
              key={step.title}
              className="relative rounded-xl border border-border bg-ui-bg/50 px-3.5 py-4 text-left"
            >
              <span className="mb-3 inline-flex h-7 w-7 items-center justify-center rounded-lg bg-brand-primary text-[11px] font-bold text-white">
                {index + 1}
              </span>
              <div className="mb-2 flex items-center gap-1.5 text-brand-secondary">
                <Icon className="h-3.5 w-3.5" aria-hidden />
                <p className="text-xs font-semibold text-text-primary">{step.title}</p>
              </div>
              <p className="text-[11px] leading-relaxed text-slate-500">{step.body}</p>
            </li>
          );
        })}
      </ol>

      <div className="mx-auto grid w-full max-w-xl grid-cols-1 gap-2.5 sm:grid-cols-3">
        <StatChip
          icon={ClipboardCheck}
          label="Questa settimana"
          value={
            casesThisWeek === 1 ? "1 caso completato" : `${casesThisWeek} casi completati`
          }
        />
        <StatChip
          icon={Target}
          label="Punteggio medio"
          value={averageScore != null ? `${averageScore}/100` : "Ancora nessun score"}
        />
        <StatChip icon={Pill} label="Focus consigliato" value={focusShort} />
      </div>
    </div>
  );
}

/** @deprecated Prefer PrassiWelcomeDashboard — kept as alias for older imports. */
export function PrassiEmptyState(props: PrassiWelcomeDashboardProps) {
  return <PrassiWelcomeDashboard {...props} />;
}
