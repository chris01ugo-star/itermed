"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/ui/dialog";
import { Button } from "@/app/ui/button";

type StartCaseButtonsProps = {
  caseId: string;
  /** Se fornito, avvia la sessione senza navigazione diretta (master-detail Prassi). */
  onSessionStart?: (caseId: string, sessionId: string) => void;
  /** Destinazione di fallback se `onSessionStart` non è passato. */
  playBasePath?: string;
};

function playHref(playBasePath: string, caseId: string, sessionId: string) {
  return `${playBasePath}/${encodeURIComponent(caseId)}?sessionId=${encodeURIComponent(sessionId)}`;
}

type LimitDialogState = {
  mode: "original" | "variant";
  message: string;
};

export function StartCaseButtons({
  caseId,
  onSessionStart,
  playBasePath = "/dashboard/prassi/play",
}: StartCaseButtonsProps) {
  const router = useRouter();
  const [isStartingOriginal, setIsStartingOriginal] = useState(false);
  const [isStartingVariant, setIsStartingVariant] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [limitDialog, setLimitDialog] = useState<LimitDialogState | null>(null);

  const navigateToSession = (sessionId: string) => {
    const href = playHref(playBasePath, caseId, sessionId);
    if (onSessionStart) {
      onSessionStart(caseId, sessionId);
    } else {
      router.push(href);
    }
    // Soft nav can stall inside nested dashboard layouts — hard fallback.
    window.setTimeout(() => {
      if (!window.location.pathname.includes(`/prassi/play/`)) {
        window.location.assign(href);
      }
    }, 800);
  };

  const start = async (mode: "original" | "variant", opts?: { devBypass?: boolean }) => {
    setError(null);
    try {
      if (mode === "original") {
        setIsStartingOriginal(true);
      } else {
        setIsStartingVariant(true);
      }

      const res = await fetch("/api/session/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseId,
          mode,
          ...(opts?.devBypass ? { devBypass: true } : {}),
        }),
      });

      const data = (await res.json().catch(() => null)) as {
        sessionId?: string;
        error?: string;
        code?: string;
      } | null;

      if (!res.ok) {
        const code = data?.code;
        const message =
          data?.error?.trim() ||
          (res.status === 401
            ? "Sessione scaduta. Accedi di nuovo."
            : "Errore nell'avvio della sessione.");

        if (code === "DAILY_LIMIT" || code === "TRIAL_EXHAUSTED") {
          setLimitDialog({ mode, message });
          return;
        }

        throw new Error(message);
      }

      const sessionId = data?.sessionId?.trim();
      if (!sessionId) {
        throw new Error("Sessione creata senza ID. Riprova.");
      }

      setLimitDialog(null);
      navigateToSession(sessionId);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Errore nell'avvio della sessione.");
    } finally {
      setIsStartingOriginal(false);
      setIsStartingVariant(false);
    }
  };

  const isBusy = isStartingOriginal || isStartingVariant;

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <button
          type="button"
          className="inline-flex min-h-10 w-full items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          onClick={() => void start("original")}
          disabled={isBusy}
        >
          {isStartingOriginal ? "Avvio..." : "Gioca caso originale"}
        </button>
        <button
          type="button"
          className="inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-lg bg-[#1E324E] px-4 py-2 font-display text-sm font-medium text-white transition-colors hover:bg-[#2A486D] disabled:cursor-not-allowed disabled:opacity-60"
          onClick={() => void start("variant")}
          disabled={isBusy}
        >
          {isStartingVariant ? (
            "Generazione variante..."
          ) : (
            <>
              <Sparkles className="h-4 w-4 shrink-0" aria-hidden />
              Genera variante IA
            </>
          )}
        </button>
      </div>
      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800"
        >
          {error}
        </p>
      ) : null}

      <Dialog open={Boolean(limitDialog)}>
        <DialogContent className="max-w-md rounded-2xl border-slate-200 p-5 shadow-2xl sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base text-slate-800">
              Simulazioni di oggi esaurite
            </DialogTitle>
            <DialogDescription className="text-sm leading-relaxed text-slate-600">
              {limitDialog?.message ??
                "Hai finito le simulazioni disponibili per oggi. Il contatore si resetta a mezzanotte."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="rounded-lg"
              onClick={() => setLimitDialog(null)}
              disabled={isBusy}
            >
              Chiudi
            </Button>
            <Button
              type="button"
              className="rounded-lg bg-[#1E324E] text-white hover:bg-[#2A486D]"
              disabled={isBusy || !limitDialog}
              onClick={() => {
                if (!limitDialog) return;
                void start(limitDialog.mode, { devBypass: true });
              }}
            >
              {isBusy ? "Avvio..." : "Sono un dev"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
