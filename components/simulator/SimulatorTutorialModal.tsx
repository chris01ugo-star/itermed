"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  Compass,
  FolderOpen,
  MessageCircle,
  Pill,
  Scale,
  X,
} from "lucide-react";
import { cn } from "@/app/utils/cn";

const STEPS = [
  {
    id: "plancia",
    label: "Plancia",
    title: "La plancia clinica e lo stress",
    icon: Activity,
    lead: "In alto hai il quadro del paziente in questo momento: parametri, tempo e tenuta della relazione.",
    points: [
      "Leggi frequenza, pressione, saturazione e gli altri vitali prima di chiedere esami. Un valore instabile viene prima del resto.",
      "Il tempo simulato scorre con le tue azioni. Il budget SSN si muove quando prescrivi esami e farmaci.",
      "La barra di stress è contestuale: Calmo, In tensione, Critico da 80 in su. La didascalia dice perché il paziente si è calmato o agitato, in base a parole e interventi.",
    ],
  },
  {
    id: "anamnesi",
    label: "Dialogo",
    title: "Anamnesi e dialogo con il paziente",
    icon: MessageCircle,
    lead: "La storia si raccoglie parlando. Il paziente risponde a quello che chiedi, con la voce e i limiti del caso.",
    points: [
      "Parti da una domanda aperta: da quando, dove, cosa lo preoccupa. Poi precisa tempi, farmaci, allergie e malattie note.",
      "Il dialogo ha un tetto di turni. Ogni messaggio consuma tempo clinico: meglio poche domande precise che un elenco generico.",
      "Empatia, ascolto e frasi chiare, senza gergo criptico, abbassano lo stress e alzano il punteggio di relazione. Una formula ripetuta rassicura meno.",
    ],
  },
  {
    id: "cartella",
    label: "Cartella",
    title: "Cartella, esame obiettivo ed esami",
    icon: FolderOpen,
    lead: "La cartella clinica è la fonte dei fatti già noti. Gli esami aggiungono solo quello che chiedi.",
    points: [
      "Apri la Cartella per triage, storia e allergie prima di prescrivere. Quei dati non vanno chiesti due volte se sono già scritti.",
      "Esegui le manovre di esame obiettivo che il quadro richiede. Il reperto resta nel tracciato e conta nella valutazione.",
      "Gli esami arrivano come referti ospedalieri: tabelle di laboratorio ed emogasanalisi, sezioni per imaging ed ECG. Leggili prima di chiudere la diagnosi.",
    ],
  },
  {
    id: "terapia",
    label: "Terapia",
    title: "Terapia, consenso e dimissione",
    icon: Pill,
    lead: "Chiudi il caso solo quando diagnosi, cure e documenti sono coerenti con quello che hai visto.",
    points: [
      "Nel Ricettario scegli farmaco, via e posologia. Controlla le allergie: un farmaco controindicato può azzerare la clinica.",
      "Raccogli il Consenso informato prima di una procedura invasiva. Il modulo registrato è quello che la tutela riconosce.",
      "Scrivi la diagnosi e il Referto di dimissione. Un diario assente o troppo corto pesa sulla tutela medico-legale.",
    ],
  },
  {
    id: "voto",
    label: "Voto",
    title: "Valutazione in trentesimi",
    icon: Scale,
    lead: "Il voto è su 30 e si scompone in cinque pilastri. Nel report finale ogni colonna si apre e mostra il calcolo.",
    points: [
      "Clinica 30% · 9/30. Tutela medico-legale 30% · 9/30. Appropriatezza esami 15% · 4,5/30.",
      "Empatia e relazione 15% · 4,5/30. Sostenibilità economica SSN 10% · 3/30. Esami ed economia restano due voti distinti.",
      "Un'allergia fatale, un'omissione salvavita o un referto assente fanno scattare un errore critico o uno sbarramento: gli altri pilastri non li compensano.",
    ],
  },
] as const;

type SimulatorTutorialModalProps = {
  open: boolean;
  onClose: () => void;
};

export function SimulatorTutorialModal({ open, onClose }: SimulatorTutorialModalProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const step = STEPS[stepIndex] ?? STEPS[0];
  const Icon = step.icon;
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === STEPS.length - 1;

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center p-3 sm:items-center sm:p-6">
      <button
        type="button"
        aria-label="Chiudi la guida"
        className="absolute inset-0 bg-[#0F1C2E]/55"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="simulator-tutorial-title"
        className="relative z-10 flex max-h-[min(92dvh,760px)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,28,46,0.28)]"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[#345884]">
              <Compass className="h-3.5 w-3.5" strokeWidth={1.75} />
              Guida del simulatore
            </p>
            <p className="mt-0.5 text-xs text-slate-500">Uguale per ogni caso. Chiuderla non azzera la simulazione.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Chiudi"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
          >
            <X className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </div>

        <div className="flex gap-1 overflow-x-auto border-b border-slate-100 px-3 py-2 sm:px-4">
          {STEPS.map((item, index) => {
            const active = index === stepIndex;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setStepIndex(index)}
                className={cn(
                  "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold transition",
                  active
                    ? "bg-[#1E324E] text-white"
                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-800",
                )}
              >
                {index + 1}. {item.label}
              </button>
            );
          })}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#E4EAF3] text-[#345884]">
              <Icon className="h-5 w-5" strokeWidth={1.75} />
            </span>
            <div className="min-w-0">
              <h2 id="simulator-tutorial-title" className="font-display text-xl font-semibold tracking-tight text-[#1E324E]">
                {step.title}
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{step.lead}</p>
            </div>
          </div>
          <ul className="mt-4 space-y-2.5">
            {step.points.map((point) => (
              <li
                key={point}
                className="rounded-xl border border-slate-100 bg-[#F7F9FC] px-3.5 py-3 text-sm leading-relaxed text-slate-700"
              >
                {point}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/80 px-4 py-3 sm:px-5">
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-medium text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline"
          >
            Salta guida
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setStepIndex((index) => Math.max(0, index - 1))}
              disabled={isFirst}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Indietro
            </button>
            {isLast ? (
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center gap-1 rounded-lg bg-[#1E324E] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#345884]"
              >
                Inizia simulazione
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setStepIndex((index) => Math.min(STEPS.length - 1, index + 1))}
                className="inline-flex items-center gap-1 rounded-lg bg-[#1E324E] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#345884]"
              >
                Avanti
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
