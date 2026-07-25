import type { ElementType } from "react";
import { Award, Flame, Target } from "lucide-react";
import { cn } from "@/app/utils/cn";

type OverviewStatsBarProps = {
  completedCount: number;
  iterMedScore: number | null;
  focusShort: string;
  streakDays: number;
};

export function OverviewStatsBar({
  completedCount,
  iterMedScore,
  focusShort,
  streakDays,
}: OverviewStatsBarProps) {
  const scorePct = iterMedScore != null ? Math.min(100, Math.round((iterMedScore / 30) * 100)) : 0;

  const cards: Array<{
    key: string;
    icon: ElementType;
    iconClass: string;
    label: string;
    value: string;
    caption: string;
    progress?: number;
  }> = [
    {
      key: "score",
      icon: Award,
      iconClass: "bg-brand-primary/10 text-brand-primary",
      label: "Score medio",
      value: iterMedScore != null ? `${iterMedScore}/30` : "—",
      caption:
        completedCount > 0
          ? `Media su ${completedCount} ${completedCount === 1 ? "simulazione" : "simulazioni"}`
          : "Completa un caso per iniziare",
      progress: scorePct,
    },
    {
      key: "focus",
      icon: Target,
      iconClass: "bg-amber-50 text-amber-600",
      label: "Focus consigliato",
      value: completedCount > 0 ? focusShort : "—",
      caption:
        completedCount > 0
          ? "Dimensione con il punteggio più basso"
          : "Emergerà dopo la prima simulazione",
    },
    {
      key: "streak",
      icon: Flame,
      iconClass: streakDays > 0 ? "bg-rose-50 text-rose-500" : "bg-slate-100 text-slate-400",
      label: "Giorni di fila",
      value: `${streakDays} ${streakDays === 1 ? "giorno" : "giorni"}`,
      caption: streakDays > 0 ? "Continua oggi per mantenerlo" : "Avvia un caso per iniziare lo streak",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {cards.map(({ key, icon: Icon, iconClass, label, value, caption, progress }) => (
        <div
          key={key}
          className="flex flex-col gap-3 rounded-xl border border-border bg-panel-bg px-5 py-4 shadow-aequan-panel"
        >
          <div className="flex items-center gap-3">
            <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", iconClass)}>
              <Icon className="h-[18px] w-[18px]" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-500">{label}</p>
              <p className="truncate text-xl font-semibold tabular-nums text-text-primary">{value}</p>
            </div>
          </div>
          {progress != null ? (
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-brand-secondary transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          ) : null}
          <p className="text-xs leading-snug text-slate-400">{caption}</p>
        </div>
      ))}
    </div>
  );
}

