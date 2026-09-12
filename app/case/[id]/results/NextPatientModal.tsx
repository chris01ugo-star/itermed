"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Stethoscope, X } from "lucide-react";

const APPEAR_DELAY_MS = 5_000;
const COUNTDOWN_SECONDS = 10;
const NEXT_QUEUE_HREF = "/dashboard/prassi";

const TRIAGE_SNIPPETS = [
  "Uomo 45 anni, dolore toracico intenso",
  "Donna 60 anni, dispnea acuta",
  "Donna 32 anni, palpitazioni e diaforesi",
  "Uomo 71 anni, sincope e ipotensione",
  "Uomo 54 anni, dolore epigastrico irradiato al braccio",
  "Donna 28 anni, dispnea dopo volo intercontinentale",
] as const;

function pickTriageSnippet(): string {
  const index = Math.floor(Math.random() * TRIAGE_SNIPPETS.length);
  return TRIAGE_SNIPPETS[index] ?? TRIAGE_SNIPPETS[0];
}

export function NextPatientModal() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(COUNTDOWN_SECONDS);
  const navigatingRef = useRef(false);
  const triageSnippet = useMemo(() => pickTriageSnippet(), []);

  const acceptCase = useCallback(() => {
    if (navigatingRef.current) return;
    navigatingRef.current = true;
    router.push(NEXT_QUEUE_HREF);
  }, [router]);

  const dismiss = useCallback(() => {
    navigatingRef.current = true;
    setOpen(false);
  }, []);

  useEffect(() => {
    const appearTimer = window.setTimeout(() => {
      if (navigatingRef.current) return;
      setOpen(true);
    }, APPEAR_DELAY_MS);

    return () => window.clearTimeout(appearTimer);
  }, []);

  useEffect(() => {
    if (!open) return;

    if (secondsLeft <= 0) {
      acceptCase();
      return;
    }

    const tick = window.setTimeout(() => {
      setSecondsLeft((current) => Math.max(0, current - 1));
    }, 1_000);

    return () => window.clearTimeout(tick);
  }, [open, secondsLeft, acceptCase]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-[color-mix(in_srgb,var(--aequan-brand-primary)_28%,transparent)] p-4"
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="next-patient-title"
        aria-describedby="next-patient-triage"
        className="w-full max-w-md overflow-hidden border border-[var(--aequan-border)] bg-[var(--aequan-panel-bg)] shadow-[0_18px_50px_-24px_rgba(30,50,78,0.45)]"
      >
        <header className="flex items-start justify-between gap-3 border-b-4 border-[var(--aequan-brand-primary)] bg-[var(--aequan-ui-bg)] px-5 py-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--aequan-text-secondary)]">
              AEQUAN · Coda clinica
            </p>
            <h2
              id="next-patient-title"
              className="mt-1 font-display text-lg font-semibold text-[var(--aequan-brand-primary)]"
            >
              Prossimo caso disponibile
            </h2>
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="inline-flex h-8 w-8 items-center justify-center border border-[var(--aequan-border)] bg-[var(--aequan-panel-bg)] text-[var(--aequan-text-secondary)] transition hover:text-[var(--aequan-brand-primary)]"
            aria-label="Chiudi"
          >
            <X className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </header>

        <div className="space-y-5 px-5 py-6 sm:px-6">
          <div className="flex items-start gap-3 border border-[var(--aequan-border)] bg-[var(--aequan-ui-bg)] px-3.5 py-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center bg-[color-mix(in_srgb,var(--aequan-brand-secondary)_12%,white)] text-[var(--aequan-brand-secondary)]">
              <Stethoscope className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            </span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--aequan-text-secondary)]">
                Presentazione
              </p>
              <p
                id="next-patient-triage"
                className="mt-0.5 font-display text-[15px] font-semibold leading-snug text-[var(--aequan-brand-primary)]"
              >
                {triageSnippet}
              </p>
            </div>
          </div>

          <div className="text-center">
            <p
              className="mx-auto flex h-14 w-14 items-center justify-center border border-[var(--aequan-border)] bg-[var(--aequan-ui-bg)] font-display text-2xl font-semibold tabular-nums text-[var(--aequan-brand-primary)]"
              aria-live="polite"
            >
              {secondsLeft}
            </p>
            <p className="mt-2 text-xs text-[var(--aequan-text-secondary)]">
              Apertura automatica della libreria casi tra {secondsLeft}s
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={acceptCase}
              className="inline-flex h-11 w-full items-center justify-center bg-[var(--aequan-brand-primary)] text-sm font-semibold text-white transition hover:bg-[var(--aequan-brand-primary-hover)]"
            >
              Apri il prossimo caso
            </button>
            <button
              type="button"
              onClick={dismiss}
              className="inline-flex h-9 w-full items-center justify-center text-xs font-medium text-[var(--aequan-text-secondary)] transition hover:text-[var(--aequan-brand-primary)]"
            >
              Resta sul referto
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
