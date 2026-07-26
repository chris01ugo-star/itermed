"use client";

import {
  Clock3,
  FlaskConical,
  History,
  LogIn,
  MessageSquare,
  Stethoscope,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/app/utils/cn";

export type SessionTimelineEvent = {
  id: string;
  timeLabel: string;
  title: string;
  detail?: string;
  kind: "ingresso" | "dialogo" | "esame" | "vitale" | "nota";
  pending?: boolean;
  current?: boolean;
};

type SessionEventTimelineProps = {
  events: SessionTimelineEvent[];
  className?: string;
  /** Dense list under coaching — less chrome, capped height. */
  compact?: boolean;
};

const KIND_META: Record<
  SessionTimelineEvent["kind"],
  { icon: LucideIcon; label: string; tone: string }
> = {
  ingresso: { icon: LogIn, label: "Ingresso", tone: "bg-slate-100 text-[#345884]" },
  dialogo: { icon: MessageSquare, label: "Dialogo", tone: "bg-[#EEF2F9] text-[#345884]" },
  esame: { icon: FlaskConical, label: "Esame", tone: "bg-[#FDF3E5] text-[#345884]" },
  vitale: { icon: Stethoscope, label: "Esame obiettivo", tone: "bg-[#EAF6F1] text-[#345884]" },
  nota: { icon: Clock3, label: "Nota", tone: "bg-[#F2F0ED] text-[#345884]" },
};

export function SessionEventTimeline({
  events,
  className,
  compact = false,
}: SessionEventTimelineProps) {
  return (
    <div
      className={cn(
        "flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm",
        compact ? "max-h-52" : "h-full",
        className,
      )}
    >
      <div
        className={cn(
          "flex shrink-0 items-center gap-2 border-b border-slate-100",
          compact ? "px-3 py-2" : "gap-2.5 px-4 py-3",
        )}
      >
        <span
          className={cn(
            "flex items-center justify-center rounded-lg bg-[#EEF2F9] text-[#345884]",
            compact ? "h-6 w-6" : "h-7 w-7",
          )}
        >
          <History className={cn(compact ? "h-3 w-3" : "h-3.5 w-3.5")} strokeWidth={1.75} />
        </span>
        <p className={cn("font-semibold text-slate-800", compact ? "text-xs" : "text-sm")}>
          Cronologia eventi
        </p>
        {compact && events.length > 0 ? (
          <span className="ml-auto text-[10px] tabular-nums text-slate-400">{events.length}</span>
        ) : null}
      </div>
      <div
        className={cn(
          "scrollbar-aequan min-h-0 flex-1 overflow-y-auto",
          compact ? "px-2.5 py-2" : "px-4 py-3",
        )}
      >
        {events.length === 0 ? (
          <p className={cn("text-center text-slate-400", compact ? "py-3 text-xs" : "py-6 text-sm")}>
            Gli eventi della sessione appariranno qui.
          </p>
        ) : (
          events.map((event, index) => {
            const meta = KIND_META[event.kind];
            const Icon = meta.icon;
            if (compact) {
              return (
                <div
                  key={event.id}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-1.5 py-1.5",
                    event.current && "bg-[#EEF2F9]/80",
                    event.pending && "opacity-50",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-md",
                      meta.tone,
                    )}
                  >
                    <Icon className="h-3 w-3" strokeWidth={1.75} />
                  </span>
                  <p className="min-w-0 flex-1 truncate text-xs font-medium text-slate-700">
                    {event.title}
                  </p>
                  {event.timeLabel ? (
                    <span className="shrink-0 text-[10px] tabular-nums text-slate-400">
                      {event.timeLabel}
                    </span>
                  ) : null}
                </div>
              );
            }

            return (
              <div key={event.id} className="relative flex gap-3 pb-4 last:pb-0">
                {index < events.length - 1 ? (
                  <span
                    className="absolute bottom-0 left-[15px] top-8 w-px bg-slate-200"
                    aria-hidden
                  />
                ) : null}
                <span
                  className={cn(
                    "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                    event.pending ? "bg-slate-50 text-slate-300 ring-1 ring-slate-200" : meta.tone,
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <div
                  className={cn(
                    "min-w-0 flex-1 rounded-lg px-2 py-1",
                    event.current && "bg-[#EEF2F9]/80",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p
                      className={cn(
                        "truncate text-sm font-semibold",
                        event.pending ? "text-slate-400" : "text-slate-800",
                      )}
                    >
                      {event.title}
                    </p>
                    {event.timeLabel ? (
                      <span className="shrink-0 text-xs tabular-nums text-slate-400">
                        {event.timeLabel}
                      </span>
                    ) : null}
                  </div>
                  <p
                    className={cn(
                      "mt-0.5 text-xs font-medium uppercase tracking-wide",
                      event.pending ? "text-slate-300" : "text-slate-400",
                    )}
                  >
                    {meta.label}
                  </p>
                  {event.detail ? (
                    <p
                      className={cn(
                        "mt-1 line-clamp-2 text-sm leading-relaxed",
                        event.pending ? "text-slate-400" : "text-slate-500",
                      )}
                    >
                      {event.detail}
                    </p>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
