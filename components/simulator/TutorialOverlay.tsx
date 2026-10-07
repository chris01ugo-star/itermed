"use client";

import { useEffect, useState } from "react";
import { writeCaseTourCompleted } from "@/lib/simulator/onboarding-storage";

export const TUTORIAL_CASE_ID = "TUTORIAL-001";

export function isTutorialCaseId(caseId: string | null | undefined): boolean {
  return caseId?.trim().toUpperCase() === TUTORIAL_CASE_ID;
}

const TOUR_STEPS = [
  {
    id: "chat",
    selector: '[data-tour="chat"]',
    title: "Dialogo",
    body: "Scrivi qui per parlare con il paziente. Inizia chiedendogli quali sintomi ha e se ha mangiato qualcosa di insolito.",
  },
  {
    id: "chart",
    selector: '[data-tour="chart"]',
    title: "Cartella clinica",
    body: "Qui puoi controllare i parametri vitali di triage.",
  },
  {
    id: "exams",
    selector: '[data-tour="exams"]',
    title: "Esami",
    body: "Clicca qui per richiedere un Emocromo e una Coprocultura.",
  },
  {
    id: "prescription",
    selector: '[data-tour="prescription"]',
    title: "Ricettario",
    body: "Usa la tendina per prescrivere Paracetamolo e Fluidi (es. Ringer Lattato).",
  },
  {
    id: "finish",
    selector: '[data-tour="finish"]',
    title: "Chiusura",
    body: "Quando pensi di aver finito, clicca qui per ricevere la valutazione.",
  },
] as const;

type Box = { top: number; left: number; width: number; height: number };

type TutorialOverlayProps = {
  open: boolean;
  onClose: () => void;
};

function measureTarget(selector: string): Box | null {
  const node = document.querySelector(selector);
  if (!(node instanceof HTMLElement)) return null;
  const rect = node.getBoundingClientRect();
  if (rect.width < 2 || rect.height < 2) return null;
  return { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
}

function placeTooltip(target: Box | null): { top: number; left: number } {
  const width = Math.min(352, window.innerWidth - 24);
  const height = 168;
  if (!target) {
    return {
      top: Math.max(16, window.innerHeight - height - 16),
      left: Math.max(12, window.innerWidth - width - 12),
    };
  }
  let left = target.left;
  let top = target.top + target.height + 12;
  if (top + height > window.innerHeight - 12) {
    top = target.top - height - 12;
  }
  if (left + width > window.innerWidth - 12) {
    left = target.left + target.width - width;
  }
  left = Math.min(Math.max(12, left), window.innerWidth - width - 12);
  top = Math.min(Math.max(12, top), window.innerHeight - height - 12);
  return { top, left };
}

export function TutorialOverlay({ open, onClose }: TutorialOverlayProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [target, setTarget] = useState<Box | null>(null);
  const step = TOUR_STEPS[stepIndex] ?? TOUR_STEPS[0];
  const isLast = stepIndex >= TOUR_STEPS.length - 1;

  useEffect(() => {
    if (open) setStepIndex(0);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const selector = step.selector;
    const node = document.querySelector(selector);
    if (node instanceof HTMLElement) {
      node.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
    const update = () => setTarget(measureTarget(selector));
    const frame = window.requestAnimationFrame(update);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, step.selector]);

  if (!open) return null;

  const tooltip = placeTooltip(target);

  function finish() {
    writeCaseTourCompleted();
    onClose();
  }

  function goNext() {
    if (isLast) {
      finish();
      return;
    }
    setStepIndex((index) => Math.min(index + 1, TOUR_STEPS.length - 1));
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-[80]" aria-hidden={false}>
      {target ? (
        <div
          className="pointer-events-none absolute rounded-xl ring-2 ring-[#345884] ring-offset-2"
          style={{
            top: target.top - 4,
            left: target.left - 4,
            width: target.width + 8,
            height: target.height + 8,
          }}
        />
      ) : null}
      <aside
        role="note"
        aria-live="polite"
        className="pointer-events-auto absolute w-[min(22rem,calc(100vw-1.5rem))] rounded-xl border border-slate-200 bg-white p-3.5 shadow-lg"
        style={{ top: tooltip.top, left: tooltip.left }}
      >
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#345884]">
          Guida {stepIndex + 1}/{TOUR_STEPS.length} · {step.title}
        </p>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-700">{step.body}</p>
        <div className="mt-3 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={finish}
            className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
          >
            Salta
          </button>
          <button
            type="button"
            onClick={goNext}
            className="rounded-lg bg-[#1E324E] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#345884]"
          >
            {isLast ? "Inizia" : "Avanti"}
          </button>
        </div>
      </aside>
    </div>
  );
}
