"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Trophy } from "lucide-react";
import type { LeaderboardEntry } from "@/lib/leaderboard/leaderboard-queries";
import { cn } from "@/app/utils/cn";

type ClinicalPerformanceRegistryProps = {
  entries: LeaderboardEntry[];
  currentUserOutsideTop50: LeaderboardEntry | null;
  totalParticipants: number;
  identity: ReactNode;
};

export function ClinicalPerformanceRegistry({
  entries,
  currentUserOutsideTop50,
  totalParticipants,
  identity,
}: ClinicalPerformanceRegistryProps) {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-panel-bg shadow-aequan-panel">
      <div className="flex items-center justify-between gap-3 border-b border-border-subtle px-5 py-4">
        <div>
          <h2 className="font-display text-base font-semibold text-[#1E324E]">Classifica</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Media sul punteggio in trentesimi
            {totalParticipants > 0 ? ` · ${totalParticipants} medici` : ""}.
          </p>
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-12 text-center">
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
        <div className="min-h-0 flex-1 overflow-y-auto scrollbar-aequan">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 z-10 bg-white">
              <tr className="border-b border-slate-100 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                <th className="w-12 px-4 py-2.5 sm:px-5">#</th>
                <th className="px-2 py-2.5 sm:px-4">Medico</th>
                <th className="hidden px-4 py-2.5 text-right sm:table-cell">Casi</th>
                <th className="px-4 py-2.5 text-right sm:px-5">Media</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {entries.map((entry) => (
                <tr
                  key={`${entry.rank}-${entry.displayName}`}
                  className={cn(
                    "transition-colors",
                    entry.isCurrentUser ? "bg-[#EEF2F9]" : "hover:bg-slate-50/80",
                  )}
                >
                  <td className="px-4 py-2.5 tabular-nums font-semibold text-slate-500 sm:px-5">
                    {entry.rank}
                  </td>
                  <td className="px-2 py-2.5 sm:px-4">
                    <span className="font-medium text-slate-800">{entry.displayName}</span>
                    {entry.isCurrentUser ? (
                      <span className="ml-2 rounded-md bg-[#1E324E] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                        Tu
                      </span>
                    ) : null}
                  </td>
                  <td className="hidden px-4 py-2.5 text-right tabular-nums text-slate-600 sm:table-cell">
                    {entry.sessionCount}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-[#1E324E] sm:px-5">
                    {entry.averageScore}
                    <span className="text-xs font-normal text-slate-400">/30</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
