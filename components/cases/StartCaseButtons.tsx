"use client";

import { useRef, useState, type MouseEvent } from "react";
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
  /** @deprecated Prefer direct Link + hard nav — kept for optional analytics hooks. */
  onSessionStart?: (caseId: string, sessionId: string) => void;
  /** Destinazione di fallback se `onSessionStart` non è passato. */
  playBasePath?: string;
  /** Which action looks primary. Default keeps legacy variant emphasis. */
  emphasis?: "original" | "variant";
};

/** Hard timeout: never wait longer than this for /api/session/start (varianti). */
const SESSION_START_DEADLINE_MS = 1_500;

function playHref(playBasePath: string, caseId: string, sessionId?: string) {
  const base = `${playBasePath}/${encodeURIComponent(caseId)}`;
  if (!sessionId || sessionId.startsWith("registry_")) return base;
  return `${base}?sessionId=${encodeURIComponent(sessionId)}`;
}

type LimitDialogState = {
  mode: "original" | "variant";
  message: string;
};

function fetchWithDeadline(
  input: RequestInfo | URL,
  init: RequestInit,
  ms: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), ms);
  return fetch(input, { ...init, signal: controller.signal }).finally(() => {
    window.clearTimeout(timer);
  });
}

export function StartCaseButtons({
  caseId,
  onSessionStart,
  playBasePath = "/dashboard/prassi/play",
  emphasis = "variant",
}: StartCaseButtonsProps) {
  const [isStartingOriginal, setIsStartingOriginal] = useState(false);
  const [isStartingVariant, setIsStartingVariant] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [limitDialog, setLimitDialog] = useState<LimitDialogState | null>(null);
  const navigatedRef = useRef(false);

  const directPlayHref = playHref(playBasePath, caseId);

  const forceNavigate = (sessionId?: string) => {
    if (navigatedRef.current) return;
    navigatedRef.current = true;
    const href = playHref(playBasePath, caseId, sessionId);
    try {
      onSessionStart?.(caseId, sessionId?.trim() || `registry_${caseId}`);
    } catch {
      // Ignore analytics/router hooks — hard nav below is the source of truth.
    }
    window.location.assign(href);
  };

  const startVariant = async (opts?: { devBypass?: boolean }) => {
    setError(null);
    navigatedRef.current = false;
    setIsStartingVariant(true);

    const emergencyTimer = window.setTimeout(() => {
      forceNavigate();
      setIsStartingVariant(false);
    }, SESSION_START_DEADLINE_MS);

    try {
      const res = await fetchWithDeadline(
        "/api/session/start",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            caseId,
            mode: "variant",
            ...(opts?.devBypass ? { devBypass: true } : {}),
          }),
        },
        SESSION_START_DEADLINE_MS,
      );

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
          window.clearTimeout(emergencyTimer);
          setLimitDialog({ mode: "variant", message });
          return;
        }

        forceNavigate();
        return;
      }

      forceNavigate(data?.sessionId?.trim());
    } catch {
      setError("Variante non disponibile. Apertura del caso originale…");
      forceNavigate();
    } finally {
      window.clearTimeout(emergencyTimer);
      setIsStartingVariant(false);
    }
  };

  const handleOriginalClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    setIsStartingOriginal(true);
    window.location.assign(directPlayHref);
  };

  const handleVariantClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    try {
      void startVariant();
    } catch {
      window.location.assign(directPlayHref);
    }
  };

  const isBusy = isStartingOriginal || isStartingVariant;
  const isDev = process.env.NODE_ENV === "development";

  const primaryClass =
    "inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-[#1E324E] px-4 py-2.5 text-center font-display text-sm font-semibold text-white transition-colors hover:bg-[#2A486D]";
  const secondaryClass =
    "inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-border bg-panel-bg px-4 py-2.5 text-center text-sm font-medium text-slate-700 transition-colors hover:border-brand-secondary/30 hover:bg-brand-secondary/[0.04]";

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <a
          href={directPlayHref}
          onClick={handleOriginalClick}
          aria-busy={isStartingOriginal}
          className={emphasis === "original" ? primaryClass : secondaryClass}
        >
          {isStartingOriginal ? "Avvio..." : "Avvia caso originale"}
        </a>
        <button
          type="button"
          onClick={handleVariantClick}
          aria-busy={isStartingVariant}
          className={emphasis === "variant" ? primaryClass : secondaryClass}
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
            {isDev ? (
              <Button
                type="button"
                className="rounded-lg bg-[#1E324E] text-white hover:bg-[#2A486D]"
                disabled={isBusy || !limitDialog}
                onClick={() => {
                  if (!limitDialog) return;
                  if (limitDialog.mode === "original") {
                    window.location.assign(directPlayHref);
                    return;
                  }
                  try {
                    void startVariant({ devBypass: true });
                  } catch {
                    window.location.assign(directPlayHref);
                  }
                }}
              >
                {isBusy ? "Avvio..." : "Sono un dev"}
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
