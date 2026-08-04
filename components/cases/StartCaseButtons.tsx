"use client";

import { useRef, useState, type MouseEvent } from "react";
import Link from "next/link";
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
};

/** Hard timeout: never wait longer than this for /api/session/start. */
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
}: StartCaseButtonsProps) {
  const [isStartingOriginal, setIsStartingOriginal] = useState(false);
  const [isStartingVariant, setIsStartingVariant] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [limitDialog, setLimitDialog] = useState<LimitDialogState | null>(null);
  const navigatedRef = useRef(false);

  const directPlayHref = playHref(playBasePath, caseId);

  /** Native hard navigation — never depends on Next soft routing. */
  const forceNavigate = (sessionId?: string) => {
    if (navigatedRef.current) return;
    navigatedRef.current = true;
    const href = playHref(playBasePath, caseId, sessionId);
    try {
      onSessionStart?.(caseId, sessionId?.trim() || `registry_${caseId}`);
    } catch (err) {
      console.error("[DEBUG CLICK] onSessionStart threw", err);
    }
    try {
      console.log("[DEBUG CLICK] forceNavigate", { caseId, href });
      window.location.href = href;
    } catch (err) {
      console.error("[DEBUG CLICK] window.location.href failed", err);
      window.location.assign(href);
    }
  };

  const start = async (mode: "original" | "variant", opts?: { devBypass?: boolean }) => {
    console.log("[DEBUG CLICK]", caseId, { mode });
    setError(null);
    navigatedRef.current = false;

    if (mode === "original") {
      setIsStartingOriginal(true);
    } else {
      setIsStartingVariant(true);
    }

    // Emergency: if anything stalls, open play anyway within 1.5s.
    const emergencyTimer = window.setTimeout(() => {
      console.warn("[DEBUG CLICK] emergency deadline — hard redirect", {
        caseId,
        href: directPlayHref,
      });
      forceNavigate();
      setIsStartingOriginal(false);
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
            mode,
            ...(opts?.devBypass ? { devBypass: true } : {}),
          }),
        },
        SESSION_START_DEADLINE_MS,
      );

      const data = (await res.json().catch(() => null)) as {
        sessionId?: string;
        error?: string;
        code?: string;
        offline?: boolean;
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
          setLimitDialog({ mode, message });
          return;
        }

        console.warn("[DEBUG CLICK] session API error — redirecting anyway", {
          caseId,
          status: res.status,
          code,
          message,
        });
        forceNavigate();
        return;
      }

      const sessionId = data?.sessionId?.trim();
      setLimitDialog(null);
      forceNavigate(sessionId);
    } catch (err) {
      console.error("[DEBUG CLICK] exception — forcing play redirect", {
        caseId,
        mode,
        err,
      });
      setError(
        err instanceof Error
          ? `${err.message} Apertura diretta della simulazione…`
          : "Errore nell'avvio. Apertura diretta…",
      );
      forceNavigate();
    } finally {
      window.clearTimeout(emergencyTimer);
      setIsStartingOriginal(false);
      setIsStartingVariant(false);
    }
  };

  const handleOriginalClick = (event: MouseEvent<HTMLAnchorElement>) => {
    console.log("[DEBUG CLICK]", caseId);
    // Allow open-in-new-tab / modified clicks to use the native Link href.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    event.preventDefault();
    try {
      void start("original");
    } catch (err) {
      console.error("[DEBUG CLICK] sync throw — forcing redirect", err);
      window.location.href = directPlayHref;
    }
  };

  const handleVariantClick = (event: MouseEvent<HTMLAnchorElement>) => {
    console.log("[DEBUG CLICK]", caseId, { mode: "variant" });
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    event.preventDefault();
    try {
      void start("variant");
    } catch (err) {
      console.error("[DEBUG CLICK] variant sync throw — forcing redirect", err);
      window.location.href = directPlayHref;
    }
  };

  const isBusy = isStartingOriginal || isStartingVariant;

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {/* Native HTML fallback: works without JS; JS enhances with session create (≤1.5s). */}
        <Link
          href={directPlayHref}
          prefetch
          onClick={handleOriginalClick}
          aria-busy={isStartingOriginal}
          className="inline-flex min-h-10 w-full items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-center text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-800"
        >
          {isStartingOriginal ? "Avvio..." : "Gioca caso originale"}
        </Link>
        <Link
          href={directPlayHref}
          prefetch={false}
          onClick={handleVariantClick}
          aria-busy={isStartingVariant}
          className="inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-lg bg-[#1E324E] px-4 py-2 text-center font-display text-sm font-medium text-white transition-colors hover:bg-[#2A486D]"
        >
          {isStartingVariant ? (
            "Generazione variante..."
          ) : (
            <>
              <Sparkles className="h-4 w-4 shrink-0" aria-hidden />
              Genera variante IA
            </>
          )}
        </Link>
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
                console.log("[DEBUG CLICK]", caseId, { mode: limitDialog.mode, devBypass: true });
                try {
                  void start(limitDialog.mode, { devBypass: true });
                } catch (err) {
                  console.error("[DEBUG CLICK] dev bypass throw", err);
                  window.location.href = directPlayHref;
                }
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
