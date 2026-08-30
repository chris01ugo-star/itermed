"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowUpRight, Eye, EyeOff } from "lucide-react";
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

  const inRank =
    prefs.leaderboardOptIn && metrics.rank != null && metrics.totalParticipants > 0;

  const challenge = useMemo(() => {
    if (!entry || !prefs.leaderboardOptIn) return null;
    const above = top50.find((e) => e.rank === entry.rank - 1);
    if (!above) {
      if (entry.rank === 1) {
        return "Sei primo: tieni il passo completando nuovi casi.";
      }
      return null;
    }
    const gap = Math.max(0, Number((above.averageScore - entry.averageScore).toFixed(1)));
    if (gap <= 0) {
      return `A un passo da #${above.rank} (${above.displayName}).`;
    }
    return `${gap} pt da #${above.rank} · ${above.displayName}`;
  }, [entry, prefs.leaderboardOptIn, top50]);

  const nextStep =
    challenge ??
    (metrics.completedCount === 0
      ? "Completa il primo caso per entrare in classifica."
      : !prefs.leaderboardOptIn
        ? "Attiva la visibilità per confrontarti con gli altri."
        : "Ogni nuovo caso aggiorna la tua media.");

  const showPercentile =
    inRank &&
    metrics.percentileTop != null &&
    metrics.totalParticipants >= 10;

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_0_rgba(15,23,42,0.03)]">
      <div className="border-b border-slate-100 px-5 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#345884]">
          Il tuo profilo
        </p>

        {inRank ? (
          <div className="mt-3 flex items-baseline gap-2">
            <p className="font-display text-4xl font-bold tabular-nums tracking-tight text-[#1E324E]">
              #{metrics.rank}
            </p>
            <p className="text-sm text-slate-500">
              di {metrics.totalParticipants}
              {showPercentile ? (
                <span className="text-slate-400"> · top {metrics.percentileTop}%</span>
              ) : null}
            </p>
          </div>
        ) : (
          <div className="mt-3">
            <p className="font-display text-2xl font-bold tracking-tight text-[#1E324E]">
              Fuori classifica
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {metrics.completedCount === 0
                ? "Nessun caso completato ancora."
                : "I tuoi risultati non sono pubblici."}
            </p>
          </div>
        )}

        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1 border-t border-slate-100 pt-3">
          <div>
            <dt className="text-[10px] uppercase tracking-wide text-slate-400">Media</dt>
            <dd className="mt-0.5 font-display text-xl font-semibold tabular-nums text-[#1E324E]">
              {metrics.averageScore != null ? (
                <>
                  {metrics.averageScore}
                  <span className="text-sm font-medium text-slate-400">/30</span>
                </>
              ) : (
                "—"
              )}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-wide text-slate-400">Casi</dt>
            <dd className="mt-0.5 font-display text-xl font-semibold tabular-nums text-[#1E324E]">
              {metrics.completedCount}
            </dd>
          </div>
        </dl>
      </div>

      <div className="flex flex-1 flex-col gap-4 px-5 py-4">
        {!prefs.leaderboardOptIn && metrics.completedCount > 0 ? (
          <div className="rounded-xl border border-[#345884]/15 bg-[#EEF2F9] px-4 py-3">
            <p className="text-sm font-semibold text-[#1E324E]">Entra in classifica</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              Pubblica i risultati e confrontati con gli altri medici in formazione.
            </p>
            <button
              type="button"
              disabled={isPending}
              onClick={() => setVisibility(true)}
              className="mt-2.5 inline-flex items-center gap-1.5 rounded-xl bg-[#1E324E] px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-[#345884] disabled:opacity-60"
            >
              <Eye className="h-3.5 w-3.5" strokeWidth={1.75} />
              Rendi pubblici i risultati
            </button>
          </div>
        ) : (
          <div>
            <p className="text-sm leading-snug text-slate-700">{nextStep}</p>
            <Link
              href="/dashboard/prassi"
              className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[#345884] transition hover:text-[#1E324E]"
            >
              Vai ai casi clinici
              <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.75} />
            </Link>
          </div>
        )}

        <div className="mt-auto space-y-3 border-t border-slate-100 pt-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
              Privacy classifica
            </p>
            <div className="mt-2 flex items-center justify-between gap-3">
              <p className="text-xs text-slate-600">
                {prefs.leaderboardOptIn
                  ? "Visibile agli altri"
                  : "Nascosto dalla classifica"}
              </p>
              <button
                type="button"
                disabled={isPending}
                onClick={() => setVisibility(!prefs.leaderboardOptIn)}
                aria-pressed={prefs.leaderboardOptIn}
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
                    On
                  </>
                ) : (
                  <>
                    <EyeOff className="h-3.5 w-3.5" strokeWidth={1.75} />
                    Off
                  </>
                )}
              </button>
            </div>
          </div>

          {prefs.leaderboardOptIn ? (
            <div className="space-y-2">
              <p className="text-xs text-slate-600">Come appari in classifica</p>
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
