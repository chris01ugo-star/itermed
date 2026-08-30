"use client";

import Link from "next/link";
import { Crown, Medal, Sparkles, Trophy } from "lucide-react";
import type { LeaderboardEntry } from "@/lib/leaderboard/leaderboard-queries";
import { cn } from "@/app/utils/cn";

type ClinicalPerformanceRegistryProps = {
  entries: LeaderboardEntry[];
  currentUserOutsideTop50: LeaderboardEntry | null;
  totalParticipants: number;
};

function podiumTone(rank: number): string {
  if (rank === 1) return "border-amber-200/80 bg-gradient-to-b from-amber-50 to-white";
  if (rank === 2) return "border-slate-200 bg-gradient-to-b from-slate-50 to-white";
  return "border-[#345884]/20 bg-gradient-to-b from-[#EEF2F9] to-white";
}

function podiumIcon(rank: number) {
  if (rank === 1) return <Crown className="h-4 w-4 text-amber-600" strokeWidth={1.75} />;
  if (rank === 2) return <Medal className="h-4 w-4 text-slate-500" strokeWidth={1.75} />;
  return <Medal className="h-4 w-4 text-[#345884]" strokeWidth={1.75} />;
}

export function ClinicalPerformanceRegistry({
  entries,
  currentUserOutsideTop50,
  totalParticipants,
}: ClinicalPerformanceRegistryProps) {
  const podium = entries.slice(0, 3);
  const rest = entries.slice(3);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_0_rgba(15,23,42,0.03)]">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 bg-[#F7F9FC] px-5 py-4">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#1E324E] text-white">
            <Trophy className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#345884]">
              Competizione formativa
            </p>
            <h2 className="font-display text-lg font-bold tracking-tight text-[#1E324E]">
              Classifica nazionale
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Top 50 per punteggio medio (/30)
              {totalParticipants > 0 ? ` · ${totalParticipants} medici in gara` : ""}.
            </p>
          </div>
        </div>
        <p className="max-w-[14rem] text-right text-[11px] leading-snug text-slate-500">
          Ogni caso completato conta. Salire in classifica significa migliorare come clinico.
        </p>
      </div>

      {entries.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-14 text-center">
          <Sparkles className="h-6 w-6 text-[#345884]" strokeWidth={1.75} />
          <p className="text-sm font-semibold text-slate-800">La classifica è ancora vuota</p>
          <p className="max-w-sm text-xs leading-relaxed text-slate-500">
            Sii tra i primi: completa un caso e renditi visibile per lasciare il tuo segno.
          </p>
          <Link
            href="/dashboard/prassi"
            className="inline-flex items-center rounded-xl bg-[#1E324E] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#345884]"
          >
            Inizia un caso
          </Link>
        </div>
      ) : (
        <>
          {podium.length > 0 ? (
            <div className="border-b border-slate-100 px-4 py-4 sm:px-5">
              <div
                className={cn(
                  "grid items-end gap-2 sm:gap-3",
                  podium.length >= 3 ? "grid-cols-3" : podium.length === 2 ? "grid-cols-2" : "grid-cols-1 max-w-xs mx-auto",
                )}
              >
                {(podium.length >= 3
                  ? ([podium[1], podium[0], podium[2]] as LeaderboardEntry[])
                  : podium
                ).map((entry) => {
                  const isFirst = entry.rank === 1;
                  return (
                    <div
                      key={`podium-${entry.rank}`}
                      className={cn(
                        "rounded-xl border px-2.5 py-3 text-center sm:px-3",
                        podiumTone(entry.rank),
                        entry.isCurrentUser && "ring-2 ring-[#345884]/35",
                        isFirst ? "pb-4 pt-4 sm:pb-5" : "pb-3",
                      )}
                    >
                      <div className="mx-auto mb-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-white shadow-sm">
                        {podiumIcon(entry.rank)}
                      </div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                        #{entry.rank}
                      </p>
                      <p
                        className={cn(
                          "mt-1 truncate text-xs font-semibold text-slate-800 sm:text-sm",
                          isFirst && "text-[#1E324E]",
                        )}
                        title={entry.displayName}
                      >
                        {entry.displayName}
                      </p>
                      {entry.isCurrentUser ? (
                        <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#345884]">
                          Sei qui
                        </p>
                      ) : null}
                      <p className="mt-2 font-display text-lg font-bold tabular-nums text-[#1E324E] sm:text-xl">
                        {entry.averageScore}
                        <span className="text-xs font-medium text-slate-400">/30</span>
                      </p>
                      <p className="text-[10px] text-slate-500">
                        {entry.sessionCount} sim · {entry.averageAccuracyPercent}%
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="min-h-0 flex-1 overflow-y-auto scrollbar-aequan">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 z-10 bg-white">
                <tr className="border-b border-slate-100 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                  <th className="w-14 px-4 py-2.5 sm:px-5">#</th>
                  <th className="px-2 py-2.5 sm:px-4">Medico</th>
                  <th className="hidden px-4 py-2.5 text-right sm:table-cell">Casi</th>
                  <th className="hidden px-4 py-2.5 text-right md:table-cell">Accuratezza</th>
                  <th className="px-4 py-2.5 text-right sm:px-5">Punteggio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rest.length === 0 && podium.length > 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-6 text-center text-xs text-slate-400">
                      Solo i primi 3 posti sono occupati — c&apos;è spazio per salire.
                    </td>
                  </tr>
                ) : null}
                {rest.map((entry) => (
                  <tr
                    key={`${entry.rank}-${entry.displayName}`}
                    className={cn(
                      "transition-colors",
                      entry.isCurrentUser
                        ? "bg-[#EEF2F9]"
                        : "hover:bg-slate-50/80",
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
                    <td className="hidden px-4 py-2.5 text-right tabular-nums text-slate-600 md:table-cell">
                      {entry.averageAccuracyPercent}%
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

          {currentUserOutsideTop50 ? (
            <div className="border-t border-[#345884]/20 bg-[#EEF2F9] px-5 py-3.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#345884]">
                La tua posizione — fuori dalla top 50
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                <span className="font-bold tabular-nums text-[#1E324E]">
                  #{currentUserOutsideTop50.rank}
                </span>
                <span className="font-medium text-slate-800">
                  {currentUserOutsideTop50.displayName}
                </span>
                <span className="ml-auto tabular-nums text-slate-600">
                  {currentUserOutsideTop50.averageScore}/30 ·{" "}
                  {currentUserOutsideTop50.sessionCount} sim
                </span>
              </div>
              <p className="mt-1 text-[11px] text-slate-500">
                Continua a simulare: ogni caso può avvicinarti alla top 50.
              </p>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
