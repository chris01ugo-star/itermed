"use client";

import { useEffect, useState } from "react";
import {
  Activity,
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
  DialogHeader,
  DialogTitle,
} from "@/app/ui/dialog";
import { Button } from "@/app/ui/button";
import { writeTutorialCompleted } from "@/lib/simulator/onboarding-storage";
import { cn } from "@/app/utils/cn";

const MEDICAL_BLUE = "#1E324E";

const TUTORIAL_STEPS = [
  {
    id: "vitals",
    title: "Telemetria & Monitor Vitali",
    eyebrow: "Strip superiore · multiparametrico",
    body: "In alto trovi il monitor in tempo reale (PA, FC, SpO₂, Temp, FR). Presta attenzione immediata ai parametri in rosso e ai pazienti instabili.",
    detail:
      "Il badge «PAZIENTE INSTABILE» e i vitali critici (es. SpO₂ < 90%) hanno priorità ABC rispetto a qualsiasi approfondimento anamnestico.",
    icon: HeartPulse,
  },
  {
    id: "chat",
    title: "Anamnesi & Dialogo Clinico",
    eyebrow: "Area centrale · chat paziente",
    body: "Usa la chat per raccogliere i sintomi dal paziente virtuale. Un Nudge discreto ti aiuterà se ti fermi per più di 2 minuti.",
    detail:
      "Domande aperte, fattori di rischio e red flag alimentano Accuratezza Clinica ed Empatia nel Coaching live.",
    icon: MessageCircle,
  },
  {
    id: "chart",
    title: "Cartella, Esami & Budget SSN",
    eyebrow: "Cartella · laboratorio · imaging",
    body: "Apri la cartella clinica a destra per richiedere EKG, laboratori o imaging. Rispetta l’appropriatezza prescrittiva ed il budget SSN.",
    detail:
      "Più di 3 esami prima di un’anamnesi adeguata riduce Appropriatezza Esami sia nel live coaching sia nel voto finale.",
    icon: FolderOpen,
  },
  {
    id: "coaching",
    title: "Live Coaching & Referto di Dimissione",
    eyebrow: "Pannello destro · chiusura caso",
    body: "Controlla le 4 macro-aree telemetriche a destra. Quando il quadro è chiaro, clicca su «Referto di dimissione» per inviare la diagnosi finale.",
    detail:
      "Clinica 30% · Sicurezza/ABC 30% · Esami 20% · Empatia 20% — stessa struttura del punteggio in 30esimi del report ufficiale.",
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
      <DialogContent className="max-w-lg overflow-hidden rounded-xl border border-slate-200 bg-white p-0 shadow-2xl">
        <div className="px-6 pb-5 pt-5 text-white" style={{ backgroundColor: MEDICAL_BLUE }}>
          <DialogHeader className="mb-0 space-y-3 text-left">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[10px] font-mono uppercase tracking-wider text-white/70">
                Tutorial Aequan · Passo {stepIndex + 1} di {TUTORIAL_STEPS.length}
              </p>
              <span className="rounded border border-white/25 bg-white/10 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider text-white/90">
                First-run
              </span>
            </div>

            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-white/20 bg-white/10 text-white">
                <Icon className="h-5 w-5" strokeWidth={1.75} />
              </span>
              <div className="min-w-0 space-y-1">
                <p className="text-[10px] font-mono uppercase tracking-wider text-white/65">
                  {step.eyebrow}
                </p>
                <DialogTitle className="text-lg font-semibold leading-snug text-white">
                  {step.title}
                </DialogTitle>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="space-y-3 bg-slate-50 px-6 py-5">
          <DialogDescription className="space-y-3 text-left">
            <p className="text-sm font-medium leading-relaxed text-slate-800">{step.body}</p>
            <p className="rounded-md border border-slate-200 bg-white px-3 py-2.5 text-xs leading-relaxed text-slate-600">
              {step.detail}
            </p>
          </DialogDescription>

          <div className="flex items-center justify-center gap-2 pt-1">
            {TUTORIAL_STEPS.map((s, i) => (
              <button
                key={s.id}
                type="button"
                aria-label={`Vai allo step ${i + 1}: ${s.title}`}
                aria-current={i === stepIndex ? "step" : undefined}
                onClick={() => setStepIndex(i)}
                className={cn(
                  "h-2.5 rounded-full transition-all",
                  i === stepIndex
                    ? "w-8 bg-[#345884]"
                    : "w-2.5 bg-slate-300 hover:bg-slate-400",
                )}
              />
            ))}
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 border-t border-slate-200 bg-white px-6 py-4 sm:flex-row sm:justify-between">
          <button
            type="button"
            onClick={finish}
            className="order-2 text-center text-xs font-medium text-slate-500 underline-offset-2 hover:text-slate-700 hover:underline sm:order-1 sm:text-left"
          >
            Salta tutorial
          </button>
          <div className="order-1 flex w-full items-center justify-end gap-2 sm:order-2 sm:w-auto">
            {stepIndex > 0 ? (
              <Button type="button" size="sm" variant="outline" onClick={goPrev}>
                Indietro
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              className="bg-[#1E324E] text-white hover:bg-[#2A486D]"
              onClick={goNext}
            >
              {isLast ? (
                <span className="inline-flex items-center gap-1.5">
                  <Activity className="h-3.5 w-3.5" />
                  Inizia Simulazione
                </span>
              ) : (
                "Avanti"
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
