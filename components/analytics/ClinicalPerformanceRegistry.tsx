"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Trophy } from "lucide-react";
import type { LeaderboardEntry } from "@/lib/leaderboard/leaderboard-queries";
import { initialsFromLabel } from "@/lib/avatar-initials";
import { cn } from "@/app/utils/cn";

type ClinicalPerformanceRegistryProps = {
  entries: LeaderboardEntry[];
  currentUserOutsideTop50: LeaderboardEntry | null;
  totalParticipants: number;
  identity: ReactNode;
};

function rankTone(rank: number, isCurrent: boolean) {
  if (rank === 1) return "bg-amber-100 text-amber-800";
  if (rank === 2) return "bg-slate-200 text-slate-700";
  if (rank === 3) return "bg-[#E4EAF3] text-[#1E324E]";
  if (isCurrent) return "bg-[#1E324E] text-white";
  return "bg-slate-100 text-slate-500";
}

export function ClinicalPerformanceRegistry({
  entries,
  currentUserOutsideTop50,
  totalParticipants,
  identity,
}: ClinicalPerformanceRegistryProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-panel-bg shadow-aequan-panel">
      <div className="flex items-end justify-between gap-3 border-b border-border-subtle px-5 py-4">
        <div>
          <h2 className="font-display text-sm font-semibold text-[#1E324E]">Classifica</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Media in trentesimi
            {totalParticipants > 0 ? ` · ${totalParticipants} medici` : ""}.
          </p>
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
          <Trophy className="h-6 w-6 text-slate-300" strokeWidth={1.75} />
          <p className="text-sm font-semibold text-slate-800">Ancora nessuno in elenco</p>
          <p className="max-w-sm text-xs leading-relaxed text-slate-500">
            Completa un caso e renditi visibile per comparire qui.
          </p>
          <Link
            href="/dashboard/prassi"
            className="inline-flex items-center rounded-xl bg-[#1E324E] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#345884]"
          >
            Vai ai casi
          </Link>
        </div>
      ) : (
        <ol className="divide-y divide-slate-100">
          {entries.map((entry) => (
            <li
              key={`${entry.rank}-${entry.displayName}`}
              className={cn(
                "flex items-center gap-3 px-4 py-3 sm:px-5",
                entry.isCurrentUser && "bg-[#EEF2F9]",
              )}
            >
              <span
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold tabular-nums",
                  rankTone(entry.rank, entry.isCurrentUser),
                )}
              >
                {entry.rank}
              </span>
              <span
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                  entry.isCurrentUser
                    ? "bg-[#1E324E] text-white"
                    : "bg-slate-100 text-slate-600",
                )}
                aria-hidden
              >
                {initialsFromLabel(entry.displayName)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-800">
                  {entry.displayName}
                  {entry.isCurrentUser ? (
                    <span className="ml-2 align-middle rounded-md bg-[#1E324E] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                      Tu
                    </span>
                  ) : null}
                </p>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  {entry.sessionCount} {entry.sessionCount === 1 ? "caso" : "casi"}
                </p>
              </div>
              <p className="shrink-0 font-display text-lg font-semibold tabular-nums text-[#1E324E]">
                {entry.averageScore}
                <span className="ml-0.5 text-xs font-medium text-slate-400">/30</span>
              </p>
            </li>
          ))}
        </ol>
      )}

      {currentUserOutsideTop50 ? (
        <div className="border-t border-slate-100 bg-[#F7F9FC] px-5 py-3">
          <p className="text-[11px] text-slate-500">Sei oltre i primi 50</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span className="font-bold tabular-nums text-[#1E324E]">
              #{currentUserOutsideTop50.rank}
            </span>
            <span className="font-medium text-slate-800">{currentUserOutsideTop50.displayName}</span>
            <span className="ml-auto tabular-nums text-slate-600">
              {currentUserOutsideTop50.averageScore}/30 · {currentUserOutsideTop50.sessionCount}{" "}
              casi
            </span>
          </div>
        </div>
      ) : null}

      {identity}
    </div>
  );
}
