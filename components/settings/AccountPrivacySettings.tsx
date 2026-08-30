"use client";

import { useState, useTransition } from "react";
import { signOut } from "next-auth/react";
import { Download, Shield, Trophy, Trash2 } from "lucide-react";
import { Button } from "@/app/ui/button";
import type { LeaderboardNameType } from "@prisma/client";
import { cn } from "@/app/utils/cn";

type AccountPrivacySettingsProps = {
  initialLeaderboardOptIn: boolean;
  initialLeaderboardNameType: LeaderboardNameType;
  initialNickname: string | null;
  termsAcceptedAt?: string | null;
  privacyAcceptedAt?: string | null;
};

function formatAcceptedAt(value: string | null | undefined): string {
  if (!value) return "non registrato";
  try {
    return new Date(value).toLocaleString("it-IT");
  } catch {
    return "non registrato";
  }
}

export function AccountPrivacySettings({
  initialLeaderboardOptIn,
  initialLeaderboardNameType,
  initialNickname,
  termsAcceptedAt = null,
  privacyAcceptedAt = null,
}: AccountPrivacySettingsProps) {
  const [leaderboardOptIn, setLeaderboardOptIn] = useState(initialLeaderboardOptIn);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);

  async function patchLeaderboardOptIn(next: boolean) {
    setError(null);
    setInfo(null);
    const previous = leaderboardOptIn;
    setLeaderboardOptIn(next);
    try {
      const res = await fetch("/api/leaderboard", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leaderboardOptIn: next }),
      });
      if (!res.ok) {
        setLeaderboardOptIn(previous);
        setError("Impossibile aggiornare la preferenza leaderboard.");
        return;
      }
      setInfo(
        next
          ? "Ora sei visibile in classifica secondo le preferenze sul nome."
          : "Sei uscito dalla classifica pubblica.",
      );
    } catch {
      setLeaderboardOptIn(previous);
      setError("Errore di rete durante l'aggiornamento.");
    }
  }

  async function downloadExport() {
    setError(null);
    setInfo(null);
    setExporting(true);
    try {
      const res = await fetch("/api/account/export");
      if (!res.ok) {
        setError("Esportazione non riuscita. Riprova più tardi.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "user-data-export.json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setInfo("Download avviato: user-data-export.json");
    } catch {
      setError("Errore di rete durante l'esportazione.");
    } finally {
      setExporting(false);
    }
  }

  async function deleteAccount() {
    if (confirmText.trim().toUpperCase() !== "ELIMINA") return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch("/api/account/delete", { method: "DELETE" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? "Eliminazione account non riuscita.");
        setDeleting(false);
        return;
      }
      await signOut({ callbackUrl: "/login?deleted=1" });
    } catch {
      setError("Errore di rete durante l'eliminazione.");
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_0_rgba(15,23,42,0.03)]">
        <div className="flex items-start gap-3 border-b border-slate-100 px-5 py-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#EEF2F9] text-[#345884]">
            <Trophy className="h-4 w-4" strokeWidth={1.75} />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-[#1E324E]">Classifica pubblica</h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Privacy by Default: la tua posizione non è pubblica finché non attivi questa
              opzione. Tipo nome:{" "}
              <span className="font-medium text-slate-700">{initialLeaderboardNameType}</span>
              {initialNickname ? ` (${initialNickname})` : ""}.
            </p>
          </div>
        </div>
        <div className="px-5 py-4">
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-3 transition hover:border-[#345884]/25">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#345884] focus:ring-[#345884]"
              checked={leaderboardOptIn}
              disabled={isPending}
              onChange={(e) => {
                const next = e.target.checked;
                startTransition(() => {
                  void patchLeaderboardOptIn(next);
                });
              }}
            />
            <span className="text-xs leading-relaxed text-slate-600">
              <span className="font-semibold text-slate-800">
                Mostra il mio profilo in classifica
              </span>
              <br />
              Consenso facoltativo alla pubblicazione del risultato comparativo.
            </span>
          </label>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_0_rgba(15,23,42,0.03)]">
        <div className="flex items-start gap-3 border-b border-slate-100 px-5 py-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#EEF2F9] text-[#345884]">
            <Download className="h-4 w-4" strokeWidth={1.75} />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-[#1E324E]">
              Portabilità dei dati (Art. 20 GDPR)
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Scarica profilo, sessioni, report e preferenze in un file JSON strutturato.
            </p>
          </div>
        </div>
        <div className="px-5 py-4">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="rounded-xl"
            disabled={exporting}
            onClick={() => void downloadExport()}
          >
            {exporting ? "Preparazione…" : "Scarica i miei dati (JSON)"}
          </Button>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-rose-200/80 bg-white shadow-[0_1px_0_rgba(15,23,42,0.03)]">
        <div className="flex items-start gap-3 border-b border-rose-100 bg-rose-50/40 px-5 py-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-rose-600 ring-1 ring-rose-100">
            <Trash2 className="h-4 w-4" strokeWidth={1.75} />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-rose-900">
              Diritto all&apos;oblio (Art. 17 GDPR)
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-rose-800/90">
              Elimina definitivamente account, chat, report e preferenze. L&apos;operazione non
              è reversibile.
            </p>
          </div>
        </div>
        <div className="px-5 py-4">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-xl border-rose-300 text-rose-800 hover:bg-rose-50"
            onClick={() => {
              setConfirmOpen(true);
              setConfirmText("");
            }}
          >
            Elimina account e dati personali
          </Button>
        </div>
      </section>

      <div className="flex items-start gap-2.5 rounded-xl border border-slate-100 bg-slate-50/80 px-3.5 py-3">
        <Shield className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" strokeWidth={1.75} />
        <p className="text-[11px] leading-relaxed text-slate-500">
          Termini accettati: {formatAcceptedAt(termsAcceptedAt)} · Privacy accettata:{" "}
          {formatAcceptedAt(privacyAcceptedAt)}
        </p>
      </div>

      {(error || info) && (
        <p
          className={cn("text-xs", error ? "text-rose-700" : "text-emerald-700")}
          role="status"
        >
          {error ?? info}
        </p>
      )}

      {confirmOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-account-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <h3
              id="delete-account-title"
              className="font-display text-base font-semibold text-[#1E324E]"
            >
              Conferma eliminazione account
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-slate-600">
              Questa azione cancella in modo permanente i tuoi dati personali. Per confermare
              digita <span className="font-mono font-semibold">ELIMINA</span>.
            </p>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="mt-3 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#345884] focus:ring-2 focus:ring-[#345884]/20"
              placeholder="ELIMINA"
              autoComplete="off"
              disabled={deleting}
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="rounded-xl"
                disabled={deleting}
                onClick={() => setConfirmOpen(false)}
              >
                Annulla
              </Button>
              <Button
                type="button"
                size="sm"
                className="rounded-xl bg-rose-700 text-white hover:bg-rose-800"
                disabled={deleting || confirmText.trim().toUpperCase() !== "ELIMINA"}
                onClick={() => void deleteAccount()}
              >
                {deleting ? "Eliminazione…" : "Elimina definitivamente"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
