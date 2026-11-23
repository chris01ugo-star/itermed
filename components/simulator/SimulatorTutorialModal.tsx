"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Compass,
  FolderOpen,
  MessageCircle,
  Phone,
  Pill,
  Scale,
  TestTubeDiagonal,
  Timer,
  Wallet,
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

const LAB_STEPS = [
  {
    id: "banco",
    label: "Banco",
    title: "Il banco LIS e lo SLA",
    icon: Timer,
    lead: "Sei il medico di laboratorio alla validazione. Il ticket è cieco: i numeri da soli non dicono se l'emergenza è del paziente.",
    points: [
      "In alto trovi la finestra SLA e il budget Reflex SSN. Il tempo della simulazione scorre mentre indaghi e decidi.",
      "L'obiettivo è distinguere un'emergenza clinica reale da un artefatto pre-analitico o analitico, prima di firmare.",
      "Il ticket non rivela la soluzione. Le prove stanno sul campione, sullo storico e sul dialogo con il banco o con il richiedente.",
    ],
  },
  {
    id: "indagini",
    label: "Indagini",
    title: "Indagine pre-analitica e analitica",
    icon: TestTubeDiagonal,
    lead: "Prima di decidere sui numeri, verifica le prove sul campione.",
    points: [
      "Usa le pillole in alto: Provetta, Indici HIL, Delta Check e CQI Linea.",
      "Quando il ticket lo prevede, apri anche Morfologia / Tracciati: striscio, elettroforesi o scattergram.",
      "Una pillola chiusa è una prova che non hai ancora letto. Non firmare al buio.",
    ],
  },
  {
    id: "foglio",
    label: "Foglio",
    title: "Validazione granulare per analita",
    icon: ClipboardCheck,
    lead: "Nel Foglio di validazione scegli l'esito di ciascun analita, uno per uno.",
    points: [
      "Valida il risultato se il campione è idoneo e il numero è affidabile.",
      "Sopprimi o Sospendi quando il risultato non si può refertare. Indica sempre il codice motivo: emolisi, riempimento, coagulo, matrice errata, interferenza o un altro codice del banco.",
      "Un analita inaffidabile non obbliga a fermare gli altri. La disposizione è selettiva.",
    ],
  },
  {
    id: "reflex",
    label: "Reflex",
    title: "Banco e test reflex SSN",
    icon: Wallet,
    lead: "Nel tab Banco & Reflex richiedi solo la conferma che cambia la decisione.",
    points: [
      "Ogni test ha una tariffa. La spesa si somma al budget Reflex SSN indicato in alto.",
      "Un reflex mirato chiarisce il ticket. Un pannello fuori quesito consuma risorse senza aiutare la firma.",
      "Il risultato del reflex compare dopo l'ordine e va letto prima di chiudere.",
    ],
  },
  {
    id: "linea",
    label: "Linea",
    title: "Linea interna: TSLB e medico richiedente",
    icon: Phone,
    lead: "Nel tab Linea Interna hai due telefoni separati. La domanda va alla persona che può rispondere.",
    points: [
      "TSLB di banco: provetta, striscio, centrifugazione e altre verifiche operative. Non è il canale per la storia clinica.",
      "Medico di reparto o di PS: contesto, farmaci e integratori, pressioni del reparto, comunicazione di un valore critico.",
      "Chiedi in modo mirato. Una pressione a firmare non sostituisce l'idoneità del campione.",
    ],
  },
  {
    id: "firma",
    label: "Firma",
    title: "Valore critico, read-back e firma",
    icon: Scale,
    lead: "Nel tab Notifica & Firma chiudi solo quando disposizione, nota e, se dovuto, la telefonata sono a posto.",
    points: [
      "Registra la notifica solo se il valore critico è davvero del paziente. Il canale è la telefonata sincrona, con conferma di read-back.",
      "Un artefatto non si notifica come emergenza. Un critico reale non si lascia in segreteria, fax o email.",
      "Scrivi una nota interpretativa chiara per il clinico, almeno 25 caratteri, poi clicca Firma & Chiudi Referto. Il voto usa i cinque pilastri di patologia clinica.",
    ],
  },
] as const;

type SimulatorTutorialModalProps = {
  open: boolean;
  onClose: () => void;
  variant?: "clinical" | "laboratory";
};

export function SimulatorTutorialModal({
  open,
  onClose,
  variant = "clinical",
}: SimulatorTutorialModalProps) {
  const steps = variant === "laboratory" ? LAB_STEPS : STEPS;
  const [stepIndex, setStepIndex] = useState(0);
  const safeIndex = Math.min(stepIndex, steps.length - 1);
  const step = steps[safeIndex] ?? steps[0];
  const Icon = step.icon;
  const isFirst = safeIndex === 0;
  const isLast = safeIndex === steps.length - 1;

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
            <p className="mt-0.5 text-xs text-slate-500">
              {variant === "laboratory"
                ? "Banco di medicina di laboratorio. Chiuderla non azzera la simulazione."
                : "Uguale per ogni caso. Chiuderla non azzera la simulazione."}
            </p>
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
          {steps.map((item, index) => {
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
                onClick={() => setStepIndex((index) => Math.min(steps.length - 1, index + 1))}
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
