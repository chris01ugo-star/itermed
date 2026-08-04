"use client";

import { useEffect, useState } from "react";
import {
  ClipboardList,
  FolderOpen,
  HeartPulse,
  MessageCircle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/app/ui/dialog";
import { Button } from "@/app/ui/button";
import { writeTutorialCompleted } from "@/lib/simulator/onboarding-storage";
import { cn } from "@/app/utils/cn";

const TUTORIAL_STEPS = [
  {
    id: "vitals",
    title: "Monitor dei vitali",
    body: "In alto vedi pressione, frequenza, saturazione e temperatura aggiornati in tempo reale.",
    tip: "Se un valore è rosso o compare «Paziente instabile», dai priorità a quello prima di tutto il resto.",
    icon: HeartPulse,
  },
  {
    id: "chat",
    title: "Dialogo con il paziente",
    body: "Al centro raccogli l’anamnesi: chiedi sintomi, tempi, rischi e cosa teme il paziente.",
    tip: "Parti da una domanda aperta. Se resti fermo troppo a lungo, ti arriva un piccolo promemoria.",
    icon: MessageCircle,
  },
  {
    id: "chart",
    title: "Cartella ed esami",
    body: "A destra apri la cartella per esame obiettivo, laboratori e imaging.",
    tip: "Prescrivi solo ciò che serve: gli esami pesano sul budget SSN e sul voto di appropriatezza.",
    icon: FolderOpen,
  },
  {
    id: "close",
    title: "Consenso e chiusura",
    body: "Usa «Aiuto» solo se ti serve supporto, e «Modulo consenso» quando spieghi una procedura invasiva. Nessun suggerimento automatico invade la sessione.",
    tip: "Quando il quadro è chiaro, apri «Referto di dimissione» e chiudi il caso.",
    icon: ClipboardList,
  },
] as const;

type OnboardingTutorialModalProps = {
  open: boolean;
  onComplete: () => void;
};

export function OnboardingTutorialModal({ open, onComplete }: OnboardingTutorialModalProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const step = TUTORIAL_STEPS[stepIndex] ?? TUTORIAL_STEPS[0];
  const Icon = step.icon;
  const isLast = stepIndex >= TUTORIAL_STEPS.length - 1;
  const progress = ((stepIndex + 1) / TUTORIAL_STEPS.length) * 100;

  useEffect(() => {
    if (open) setStepIndex(0);
  }, [open]);

  function finish() {
    writeTutorialCompleted();
    setStepIndex(0);
    onComplete();
  }

  function goNext() {
    if (isLast) {
      finish();
      return;
    }
    setStepIndex((i) => Math.min(i + 1, TUTORIAL_STEPS.length - 1));
  }

  function goPrev() {
    setStepIndex((i) => Math.max(0, i - 1));
  }

  return (
    <Dialog open={open}>
      <DialogContent className="max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white p-0 shadow-2xl">
        <div className="h-1 w-full bg-slate-100">
          <div
            className="h-full bg-[#345884] transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="space-y-5 px-6 pb-2 pt-6">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#345884]">
              Tutorial
            </p>
            <p className="text-[11px] font-medium tabular-nums text-slate-400">
              {stepIndex + 1} / {TUTORIAL_STEPS.length}
            </p>
          </div>

          <div className="flex items-start gap-3.5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#E4EAF3] text-[#345884]">
              <Icon className="h-5 w-5" strokeWidth={1.75} />
            </span>
            <div className="min-w-0 pt-0.5">
              <DialogTitle className="font-display text-xl font-semibold tracking-tight text-slate-900">
                {step.title}
              </DialogTitle>
              <DialogDescription className="mt-2 space-y-3 text-left">
                <p className="text-sm leading-relaxed text-slate-600">{step.body}</p>
                <p className="border-l-2 border-[#345884]/35 pl-3 text-sm leading-relaxed text-slate-700">
                  <span className="font-semibold text-[#345884]">Suggerimento. </span>
                  {step.tip}
                </p>
              </DialogDescription>
            </div>
          </div>

          <div className="flex items-center gap-1.5 pt-1">
            {TUTORIAL_STEPS.map((s, i) => (
              <button
                key={s.id}
                type="button"
                aria-label={`Passo ${i + 1}: ${s.title}`}
                aria-current={i === stepIndex ? "step" : undefined}
                onClick={() => setStepIndex(i)}
                className={cn(
                  "h-1.5 flex-1 rounded-full transition-colors",
                  i <= stepIndex ? "bg-[#345884]" : "bg-slate-200 hover:bg-slate-300",
                )}
              />
            ))}
          </div>
        </div>

        <DialogFooter className="mt-0 flex-col gap-2 border-t border-slate-100 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={finish}
            className="order-2 text-center text-xs font-medium text-slate-400 transition hover:text-slate-600 sm:order-1 sm:text-left"
          >
            Salta
          </button>
          <div className="order-1 flex w-full items-center justify-end gap-2 sm:order-2 sm:w-auto">
            {stepIndex > 0 ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="rounded-lg"
                onClick={goPrev}
              >
                Indietro
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              className="rounded-lg bg-[#1E324E] px-4 text-white hover:bg-[#2A486D]"
              onClick={goNext}
            >
              {isLast ? "Inizia" : "Avanti"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
