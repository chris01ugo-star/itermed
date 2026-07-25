"use client";

import { useState, useTransition } from "react";
import { Award, Clock3, TrendingUp, UserCircle2 } from "lucide-react";
import type { LeaderboardNameType } from "@prisma/client";
import type {
  LeaderboardPreferences,
  PersonalPerformanceMetrics,
} from "@/lib/leaderboard/leaderboard-queries";
import { SegmentedControl } from "@/components/ui/segmented-control";

type PersonalProfilePanelProps = {
  metrics: PersonalPerformanceMetrics;
  preferences: LeaderboardPreferences;
  onUpdated: () => void;
};

const NAME_OPTIONS: { value: LeaderboardNameType; label: string }[] = [
  { value: "REAL_NAME", label: "Nome reale" },
  { value: "NICKNAME", label: "Nickname" },
  { value: "ANONYMOUS", label: "Anonimo" },
];

const VISIBILITY_OPTIONS = [
  { value: "visible" as const, label: "Visibile" },
  { value: "hidden" as const, label: "Nascosto" },
];

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-ui-bg/80 px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums text-text-primary">{value}</p>
    </div>
  );
}

export function PersonalProfilePanel({
  metrics,
  preferences: initialPreferences,
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

  function setVisibility(value: "visible" | "hidden") {
    const next = value === "visible";
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

  const percentileText =
    prefs.leaderboardOptIn && metrics.percentileTop != null
      ? `Top ${metrics.percentileTop}% dei medici esaminati`
      : "Registrati in classifica per il percentile";

  return (
    <div className="flex h-full flex-col rounded-xl border border-border bg-panel-bg shadow-aequan-panel">
      <div className="flex items-center gap-2.5 border-b border-border-subtle px-5 py-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
          <UserCircle2 className="h-4 w-4" />
        </div>
        <div>
          <h2 className="font-display text-sm font-semibold text-brand-primary">
            Il tuo Profilo Performance
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Metriche personali aggregate dalle simulazioni completate.
          </p>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-4 px-5 py-4">
        <div className="grid grid-cols-2 gap-2.5">
          <StatTile
            label="Punteggio medio"
            value={metrics.averageScore != null ? `${metrics.averageScore}/30` : "—"}
          />
          <StatTile label="Simulazioni" value={String(metrics.completedCount)} />
          <StatTile
            label="Risoluzione clinica"
            value={metrics.clinicalResolutionRate != null ? `${metrics.clinicalResolutionRate}%` : "—"}
          />
          <StatTile
            label="Tempo medio"
            value={
              metrics.averageResolutionMinutes != null ? `${metrics.averageResolutionMinutes} min` : "—"
            }
          />
        </div>

        <div className="inline-flex items-center gap-2 self-start rounded-full bg-brand-primary/[0.06] px-3 py-1.5">
          <Award className="h-3.5 w-3.5 shrink-0 text-brand-primary" />
          <span className="text-xs font-medium text-brand-primary">{percentileText}</span>
        </div>

        <div className="mt-auto flex flex-col divide-y divide-border-subtle overflow-hidden rounded-lg border border-border bg-ui-bg/40">
          <div className="flex flex-wrap items-center justify-between gap-2.5 px-3 py-2.5">
            <p className="flex items-center gap-1.5 text-xs font-medium text-text-primary">
              <TrendingUp className="h-3.5 w-3.5 shrink-0 text-slate-400" /> Visibilità in
              registro
            </p>
            <SegmentedControl
              aria-label="Visibilità profilo in registro"
              options={VISIBILITY_OPTIONS}
              value={prefs.leaderboardOptIn ? "visible" : "hidden"}
              onChange={setVisibility}
              disabled={isPending}
              fullWidth={false}
            />
          </div>

          {prefs.leaderboardOptIn ? (
            <div className="flex flex-wrap items-center justify-between gap-2.5 px-3 py-2.5">
              <p className="flex items-center gap-1.5 text-xs font-medium text-text-primary">
                <Clock3 className="h-3.5 w-3.5 shrink-0 text-slate-400" /> Identità in classifica
              </p>
              <SegmentedControl
                aria-label="Tipo di identità in classifica"
                options={NAME_OPTIONS}
                value={prefs.leaderboardNameType}
                onChange={selectNameType}
                disabled={isPending}
                fullWidth={false}
              />
            </div>
          ) : null}

          {prefs.leaderboardOptIn && prefs.leaderboardNameType === "NICKNAME" ? (
            <div className="flex gap-2 px-3 py-2.5">
              <input
                type="text"
                maxLength={40}
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="Nickname"
                className="flex-1 rounded-lg border border-border bg-white px-2.5 py-1.5 text-xs text-text-primary outline-none focus:border-brand-secondary/60"
              />
              <button
                type="button"
                onClick={saveNickname}
                disabled={isPending}
                className="rounded-lg bg-brand-primary px-3 py-1.5 text-[11px] font-medium text-white transition hover:bg-brand-primary-hover"
              >
                Salva
              </button>
            </div>
          ) : null}

          {error ? <p className="px-3 pb-2.5 text-[11px] text-rose-600">{error}</p> : null}
        </div>
      </div>
    </div>
  );
}
