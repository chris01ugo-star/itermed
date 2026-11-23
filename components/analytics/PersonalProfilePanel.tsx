"use client";

import { useState, useTransition } from "react";
import { Eye, EyeOff } from "lucide-react";
import type { LeaderboardNameType } from "@prisma/client";
import type { LeaderboardPreferences } from "@/lib/leaderboard/leaderboard-queries";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { cn } from "@/app/utils/cn";

type PersonalProfilePanelProps = {
  preferences: LeaderboardPreferences;
  onUpdated: () => void;
};

const NAME_OPTIONS: { value: LeaderboardNameType; label: string }[] = [
  { value: "REAL_NAME", label: "Nome" },
  { value: "NICKNAME", label: "Nick" },
  { value: "ANONYMOUS", label: "Anonimo" },
];

export function PersonalProfilePanel({
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

  return (
    <div className="space-y-3 border-t border-slate-100 px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-slate-700">La tua visibilità</p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            {prefs.leaderboardOptIn
              ? "Appari in classifica con il nome scelto sotto."
              : "I tuoi risultati restano privati. Entra se vuoi comparire in elenco."}
          </p>
        </div>
        <button
          type="button"
          disabled={isPending}
          onClick={() => setVisibility(!prefs.leaderboardOptIn)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition disabled:opacity-60",
            prefs.leaderboardOptIn
              ? "border-[#345884]/25 bg-[#EEF2F9] text-[#1E324E]"
              : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
          )}
        >
          {prefs.leaderboardOptIn ? (
            <>
              <Eye className="h-3.5 w-3.5" strokeWidth={1.75} />
              Visibile
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
          <SegmentedControl
            aria-label="Come appari in classifica"
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
  );
}
