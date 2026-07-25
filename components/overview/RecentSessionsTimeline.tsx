import Link from "next/link";
import { ChevronRight, ClipboardList } from "lucide-react";
import { Badge } from "@/app/ui/badge";
import { DifficultyBadge } from "@/components/dashboard/DifficultyBadge";
import type { RecentSessionRow } from "@/lib/overview-queries";
import { cn } from "@/app/utils/cn";

type RecentSessionsTimelineProps = {
  sessions: RecentSessionRow[];
  compact?: boolean;
};

function scoreTone(score: number): string {
  if (score >= 75) return "bg-brand-primary/10 text-brand-primary";
  if (score >= 50) return "bg-amber-50 text-amber-700";
  return "bg-rose-50 text-rose-700";
}

export function RecentSessionsTimeline({ sessions, compact = false }: RecentSessionsTimelineProps) {
  if (sessions.length === 0) {
    return (
      <div className={cn("flex flex-col items-center justify-center gap-3 text-center", compact ? "py-6" : "py-10")}>
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
          <ClipboardList className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-medium text-text-primary">Nessun caso completato</p>
          <p className="mt-1 text-xs text-slate-500">
            Avvia una simulazione per iniziare il tuo storico.
          </p>
        </div>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="divide-y divide-border-subtle">
        {sessions.map((item) => (
          <Link
            key={item.sessionId}
            href={`/case/${item.caseId}/results?sessionId=${item.sessionId}`}
            className="group -mx-1 flex items-center justify-between gap-3 rounded-lg px-1 py-2.5 transition-colors hover:bg-slate-50"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-text-primary transition-colors group-hover:text-brand-secondary">
                {item.title}
              </p>
              <p className="mt-0.5 truncate text-xs text-slate-500">
                {item.specialty} · {item.completedLabel}
              </p>
            </div>
            <div
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-semibold",
                scoreTone(item.score),
              )}
            >
              {item.score}
            </div>
          </Link>
        ))}
      </div>
    );
  }

  return (
    <div className="relative space-y-1 pl-6">
      <div className="dashboard-timeline-line" aria-hidden />
      {sessions.map((item, index) => (
        <Link
          key={item.sessionId}
          href={`/case/${item.caseId}/results?sessionId=${item.sessionId}`}
          className="group relative flex items-center justify-between gap-4 rounded-xl py-3 pl-4 pr-2 transition-colors hover:bg-slate-50"
        >
          <span
            className={cn(
              "absolute -left-[1.125rem] top-1/2 z-10 h-2.5 w-2.5 -translate-y-1/2 rounded-full border-2 border-white shadow-sm",
              index === 0 ? "bg-brand-secondary" : "bg-slate-300",
            )}
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-text-primary transition-colors group-hover:text-brand-secondary">
              {item.title}
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <Badge variant="default">{item.specialty}</Badge>
              <DifficultyBadge difficulty={item.difficulty} />
            </div>
            <p className="mt-1.5 text-xs text-slate-500">{item.completedLabel}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <div
              className={cn(
                "flex h-11 w-11 items-center justify-center rounded-xl text-sm font-semibold",
                scoreTone(item.score),
              )}
            >
              {item.score}
            </div>
            <ChevronRight className="h-4 w-4 text-slate-400 transition-colors group-hover:text-brand-secondary" />
          </div>
        </Link>
      ))}
    </div>
  );
}
