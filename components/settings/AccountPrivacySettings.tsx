"use client";

import { useState, useTransition } from "react";
import { signOut } from "next-auth/react";
import { Button } from "@/app/ui/button";
import type { LeaderboardNameType } from "@prisma/client";

type AccountPrivacySettingsProps = {
  initialLeaderboardOptIn: boolean;
  initialLeaderboardNameType: LeaderboardNameType;
  initialNickname: string | null;
};

export function AccountPrivacySettings({
  initialLeaderboardOptIn,
  initialLeaderboardNameType,
  initialNickname,
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
    <div className="space-y-6">
      <section className="space-y-3 rounded-2xl border border-zinc-200/80 bg-white px-4 py-4">
        <div>
          <h2 className="text-sm font-semibold text-zinc-950">Classifica pubblica</h2>
          <p className="mt-1 text-xs leading-relaxed text-zinc-600">
            Privacy by Default: la tua posizione e il tuo nome non sono pubblici finché non
            attivi esplicitamente questa opzione. Tipo nome attuale:{" "}
            <span className="font-mono">{initialLeaderboardNameType}</span>
            {initialNickname ? ` (${initialNickname})` : ""}. Puoi cambiare il formato del
            nome anche dalla dashboard analitica.
          </p>
        </div>
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-zinc-200 bg-zinc-50/80 px-3 py-3">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-[#345884] focus:ring-[#345884]"
            checked={leaderboardOptIn}
            disabled={isPending}
            onChange={(e) => {
              const next = e.target.checked;
              startTransition(() => {
                void patchLeaderboardOptIn(next);
              });
            }}
          />
          <span className="text-xs leading-relaxed text-zinc-700">
            <span className="font-medium text-zinc-900">
              Mostra il mio profilo in classifica
            </span>
            <br />
            Consenso facoltativo alla pubblicazione del risultato comparativo (nome reale,
            nickname o anonimo secondo le tue preferenze).
          </span>
        </label>
      </section>

      <section className="space-y-3 rounded-2xl border border-zinc-200/80 bg-white px-4 py-4">
        <div>
          <h2 className="text-sm font-semibold text-zinc-950">
            Portabilità dei dati (Art. 20 GDPR)
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-zinc-600">
            Scarica profilo, sessioni live (incluso chatHistory), report di valutazione e
            preferenze in un file JSON strutturato.
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={exporting}
          onClick={() => void downloadExport()}
        >
          {exporting ? "Preparazione…" : "Scarica i miei dati (JSON)"}
        </Button>
      </section>

      <section className="space-y-3 rounded-2xl border border-red-200/80 bg-red-50/40 px-4 py-4">
        <div>
          <h2 className="text-sm font-semibold text-red-900">
            Diritto all&apos;oblio (Art. 17 GDPR)
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-red-800/90">
            Elimina definitivamente account, chat, report e preferenze. Gli abbonamenti
            Stripe attivi vengono annullati. I casi clinici che hai creato restano nel
            sistema ma vengono dissociati dalla tua identità. L&apos;operazione non è
            reversibile.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-red-300 text-red-800 hover:bg-red-100"
          onClick={() => {
            setConfirmOpen(true);
            setConfirmText("");
          }}
        >
          Elimina account e dati personali
        </Button>
      </section>

      {(error || info) && (
        <p
          className={`text-xs ${error ? "text-red-700" : "text-emerald-700"}`}
          role="status"
        >
          {error ?? info}
        </p>
      )}

      {confirmOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-account-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-5 shadow-lg">
            <h3 id="delete-account-title" className="text-base font-semibold text-zinc-950">
              Conferma eliminazione account
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-zinc-600">
              Questa azione cancella in modo permanente i tuoi dati personali. Per
              confermare digita <span className="font-mono font-semibold">ELIMINA</span>.
            </p>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="mt-3 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#345884] focus:ring-2 focus:ring-[#345884]/20"
              placeholder="ELIMINA"
              autoComplete="off"
              disabled={deleting}
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={deleting}
                onClick={() => setConfirmOpen(false)}
              >
                Annulla
              </Button>
              <Button
                type="button"
                size="sm"
                className="bg-red-700 text-white hover:bg-red-800"
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
