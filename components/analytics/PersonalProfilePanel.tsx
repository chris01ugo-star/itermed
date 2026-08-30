"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowUpRight, Eye, EyeOff, Target, Trophy } from "lucide-react";
import type { LeaderboardNameType } from "@prisma/client";
import type {
  LeaderboardEntry,
  LeaderboardPreferences,
  PersonalPerformanceMetrics,
} from "@/lib/leaderboard/leaderboard-queries";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { cn } from "@/app/utils/cn";

type PersonalProfilePanelProps = {
  metrics: PersonalPerformanceMetrics;
  preferences: LeaderboardPreferences;
  entry: LeaderboardEntry | null;
  top50: LeaderboardEntry[];
  onUpdated: () => void;
};

const NAME_OPTIONS: { value: LeaderboardNameType; label: string }[] = [
  { value: "REAL_NAME", label: "Nome" },
  { value: "NICKNAME", label: "Nick" },
  { value: "ANONYMOUS", label: "Anonimo" },
];

export function PersonalProfilePanel({
  metrics,
  preferences: initialPreferences,
  entry,
  top50,
  onUpdated,
}: PersonalProfilePanelProps) {
  const [prefs, setPrefs] = useState(initialPreferences);
  const [nickname, setNickname] = useState(initialPreferences.nickname ?? "");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function patchPreferences(
    patch: Partial<LeaderboardPreferences & { nickname: string | null }>,
  ) {
    setError(null);
    const res = await fetch("/api/leaderboard", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      setError("Impossibile aggiornare le preferenze.");
      return;
    }
    const data = await res.json();
    setPrefs(data.preferences);
    onUpdated();
  }

  function selectNameType(value: LeaderboardNameType) {
    setPrefs((p) => ({ ...p, leaderboardNameType: value }));
    startTransition(() => {
      void patchPreferences({
        leaderboardNameType: value,
        nickname: value === "NICKNAME" ? nickname.trim() || null : prefs.nickname,
      });
    });
  }

  function setVisibility(next: boolean) {
    setPrefs((p) => ({ ...p, leaderboardOptIn: next }));
    startTransition(() => {
      void patchPreferences({ leaderboardOptIn: next });
    });
  }

  function saveNickname() {
    startTransition(() => {
      void patchPreferences({ nickname: nickname.trim() || null });
    });
  }

  const challenge = useMemo(() => {
    if (!entry || !prefs.leaderboardOptIn) return null;
    const above = top50.find((e) => e.rank === entry.rank - 1);
    if (!above) {
      if (entry.rank === 1) {
        return "Sei in vetta. Difendi il primato completando nuovi casi.";
      }
      return null;
    }
    const gap = Math.max(0, Number((above.averageScore - entry.averageScore).toFixed(1)));
    if (gap <= 0) {
      return `Stai sfidando ${above.displayName} per il posto #${above.rank}.`;
    }
    return `A ${gap} punti da #${above.rank} (${above.displayName}). Un caso in più può bastare.`;
  }, [entry, prefs.leaderboardOptIn, top50]);

  const rankLabel =
    prefs.leaderboardOptIn && metrics.rank != null ? `#${metrics.rank}` : "—";
  const ofParticipants =
    prefs.leaderboardOptIn && metrics.totalParticipants > 0
      ? `su ${metrics.totalParticipants}`
      : null;

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_0_rgba(15,23,42,0.03)]">
      <div className="border-b border-slate-100 bg-[#1E324E] px-5 py-5 text-white">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/60">
          La tua posizione
        </p>
        <div className="mt-2 flex items-end justify-between gap-3">
          <div>
            <p className="font-display text-4xl font-bold tabular-nums tracking-tight">
              {rankLabel}
            </p>
            {ofParticipants ? (
              <p className="mt-1 text-sm text-white/70">{ofParticipants} in classifica</p>
            ) : (
              <p className="mt-1 text-sm text-white/70">Non sei ancora in classifica</p>
            )}
          </div>
          <Trophy className="h-8 w-8 shrink-0 text-white/35" strokeWidth={1.5} />
        </div>

        {prefs.leaderboardOptIn && metrics.percentileTop != null ? (
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white/90">
            <Target className="h-3.5 w-3.5" strokeWidth={1.75} />
            Top {metrics.percentileTop}% dei medici
          </p>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-4 px-5 py-4">
        {!prefs.leaderboardOptIn ? (
          <div className="rounded-xl border border-[#345884]/20 bg-[#EEF2F9] px-4 py-3.5">
            <p className="text-sm font-semibold text-[#1E324E]">Entra in classifica</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              Rendi pubblici i tuoi risultati e confrontati con altri medici in formazione.
              Essere in classifica motiva a migliorare caso dopo caso.
            </p>
            <button
              type="button"
              disabled={isPending}
              onClick={() => setVisibility(true)}
              className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-[#1E324E] px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-[#345884] disabled:opacity-60"
            >
              <Eye className="h-3.5 w-3.5" strokeWidth={1.75} />
              Rendimi visibile
            </button>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">
              Prossima sfida
            </p>
            <p className="mt-1 text-sm leading-relaxed text-slate-700">
              {challenge ??
                (metrics.completedCount === 0
                  ? "Completa il primo caso per ottenere un posto in classifica."
                  : "Continua a simulare: ogni caso rafforza il tuo punteggio medio.")}
            </p>
            <Link
              href="/dashboard/prassi"
              className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#345884] transition hover:text-[#1E324E]"
            >
              Vai ai casi clinici
              <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.75} />
            </Link>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-wide text-slate-400">Media</p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums text-[#1E324E]">
              {metrics.averageScore != null ? `${metrics.averageScore}/30` : "—"}
            </p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-wide text-slate-400">Casi</p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums text-[#1E324E]">
              {metrics.completedCount}
            </p>
          </div>
        </div>

        <div className="mt-auto space-y-2.5 border-t border-slate-100 pt-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-slate-600">Visibilità</p>
            <button
              type="button"
              disabled={isPending}
              onClick={() => setVisibility(!prefs.leaderboardOptIn)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition",
                prefs.leaderboardOptIn
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-slate-200 bg-white text-slate-500 hover:border-slate-300",
              )}
            >
              {prefs.leaderboardOptIn ? (
                <>
                  <Eye className="h-3.5 w-3.5" strokeWidth={1.75} />
                  In classifica
                </>
              ) : (
                <>
                  <EyeOff className="h-3.5 w-3.5" strokeWidth={1.75} />
                  Nascosto
                </>
              )}
            </button>
          </div>

          {prefs.leaderboardOptIn ? (
            <div className="space-y-2">
              <p className="text-xs font-medium text-slate-600">Come appari</p>
              <SegmentedControl
                aria-label="Tipo di identità in classifica"
                options={NAME_OPTIONS}
                value={prefs.leaderboardNameType}
                onChange={selectNameType}
                disabled={isPending}
                fullWidth
              />
              {prefs.leaderboardNameType === "NICKNAME" ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    maxLength={40}
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    placeholder="Nickname"
                    className="flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 outline-none focus:border-[#345884]/50 focus:ring-2 focus:ring-[#345884]/15"
                  />
                  <button
                    type="button"
                    onClick={saveNickname}
                    disabled={isPending}
                    className="rounded-lg bg-[#1E324E] px-3 py-1.5 text-[11px] font-medium text-white transition hover:bg-[#345884]"
                  >
                    Salva
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}

          {error ? <p className="text-[11px] text-rose-600">{error}</p> : null}
        </div>
      </div>
    </div>
  );
}
