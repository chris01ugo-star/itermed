"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Siren } from "lucide-react";

const APPEAR_DELAY_MS = 5_000;
const COUNTDOWN_SECONDS = 10;
const NEXT_QUEUE_HREF = "/dashboard/prassi";

const TRIAGE_SNIPPETS = [
  "Code Yellow: 45M, severe chest pain",
  "Code Red: 60F, dyspnea",
  "Code Yellow: 32F, palpitations and diaphoresis",
  "Code Red: 71M, syncope and hypotension",
  "Code Yellow: 54M, epigastric pain radiating to the left arm",
  "Code Red: 28F, acute dyspnea after long-haul flight",
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

  const passToColleague = useCallback(() => {
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
      className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/70 p-4"
      role="presentation"
    >
      <style>{`
        @keyframes next-patient-flash {
          0%, 100% { box-shadow: 0 0 0 2px #dc2626, 0 0 28px rgba(220, 38, 38, 0.45); }
          50% { box-shadow: 0 0 0 7px #ef4444, 0 0 42px rgba(239, 68, 68, 0.75); }
        }
        .next-patient-flash {
          animation: next-patient-flash 0.9s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .next-patient-flash { animation: none; box-shadow: 0 0 0 4px #dc2626; }
        }
      `}</style>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="next-patient-title"
        aria-describedby="next-patient-triage"
        className="next-patient-flash w-full max-w-md overflow-hidden rounded-2xl border-2 border-red-600 bg-[#14080a] text-white"
      >
        <div className="border-b border-red-600/50 bg-red-700 px-5 py-3">
          <p
            id="next-patient-title"
            className="flex items-center justify-center gap-2 text-center text-[11px] font-bold uppercase tracking-[0.22em] text-white"
          >
            <Siren className="h-4 w-4" strokeWidth={2.25} aria-hidden />
            Incoming emergency
          </p>
        </div>

        <div className="space-y-5 px-6 py-6">
          <p className="text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-red-300">
            Next patient in queue
          </p>
          <p
            id="next-patient-triage"
            className="text-center font-display text-lg font-semibold leading-snug text-white"
          >
            {triageSnippet}
          </p>

          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border-2 border-red-500 bg-red-950/80">
            <span className="font-mono text-3xl font-bold tabular-nums text-red-100" aria-live="polite">
              {secondsLeft}
            </span>
          </div>
          <p className="text-center text-xs text-red-200/80">
            Auto-accept in {secondsLeft}s — keep the flow going
          </p>

          <div className="flex flex-col gap-2.5">
            <button
              type="button"
              onClick={acceptCase}
              className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-red-600 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-red-500"
            >
              Accept Case
            </button>
            <button
              type="button"
              onClick={passToColleague}
              className="inline-flex h-9 w-full items-center justify-center rounded-lg text-xs font-medium text-red-200/60 underline-offset-4 transition hover:text-red-100 hover:underline"
            >
              Pass to Colleague
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
