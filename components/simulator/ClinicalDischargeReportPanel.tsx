"use client";

import { useState } from "react";
import { ChevronDown, Scale } from "lucide-react";
import { cn } from "@/app/utils/cn";
import { handleTextareaEnterSubmit } from "@/lib/hooks/textarea-submit";

export type ClinicalReportSections = {
  anamnesisObjective: string;
  diagnosticFindings: string;
  diagnosisTreatment: string;
  dischargeNote: string;
  /** Data/ora e qualifica. Opzionale: l'omissione non blocca l'invio. */
  formalClosure?: string;
};

export function composeClinicalReport(sections: ClinicalReportSections): string {
  const parts: string[] = [];

  if (sections.anamnesisObjective.trim()) {
    parts.push("=== ANAMNESI ED ESAME OBIETTIVO ESSENZIALI ===", sections.anamnesisObjective.trim());
  }
  if (sections.diagnosticFindings.trim()) {
    parts.push(
      "=== RISCONTRI DIAGNOSTICI E RAGIONAMENTO CLINICO ===",
      sections.diagnosticFindings.trim(),
    );
  }
  if (sections.diagnosisTreatment.trim()) {
    parts.push("=== DIAGNOSI, TERAPIA E CONDOTTA ===", sections.diagnosisTreatment.trim());
  }
  if (sections.dischargeNote.trim()) {
    parts.push(
      "=== INFORMAZIONE AL PAZIENTE, CONSENSO, FOLLOW-UP E RED FLAGS ===",
      sections.dischargeNote.trim(),
    );
  }
  if (sections.formalClosure?.trim()) {
    parts.push(
      "=== CHIUSURA FORMALE (DATA/ORA E QUALIFICA) ===",
      sections.formalClosure.trim(),
    );
  }

  return parts.join("\n\n");
}

export function extractFinalDiagnosisFromReport(sections: ClinicalReportSections): string {
  const block = sections.diagnosisTreatment.trim();
  if (!block) return "";

  const labeled = block.match(/(?:diagnosi\s*(?:finale|di\s*dimissione)?)\s*[:\-]\s*(.+)/i);
  if (labeled?.[1]) return labeled[1].split("\n")[0].trim();

  const firstLine = block.split("\n").map((l) => l.trim()).find((l) => l.length > 0);
  return firstLine ?? "";
}

export function isClinicalReportComplete(sections: ClinicalReportSections): boolean {
  return (
    sections.anamnesisObjective.trim().length >= 20 &&
    sections.diagnosticFindings.trim().length >= 15 &&
    sections.diagnosisTreatment.trim().length >= 10 &&
    sections.dischargeNote.trim().length >= 20
  );
}

type ClinicalDischargeReportPanelProps = {
  sections: ClinicalReportSections;
  onChange: (sections: ClinicalReportSections) => void;
  onConfirm: () => void;
  confirmDisabled?: boolean;
  isAdminExtras?: React.ReactNode;
};

const FIELDS: Array<{
  key: "anamnesisObjective" | "diagnosticFindings" | "diagnosisTreatment" | "dischargeNote";
  code: string;
  label: string;
  brief: string;
  placeholder: string;
  rows: number;
  minHint: number;
}> = [
  {
    key: "anamnesisObjective",
    code: "A",
    label: "Anamnesi ed Esame Obiettivo essenziali",
    brief: "Motivo della visita, allergie e terapia in atto, reperti obiettivi salienti.",
    placeholder:
      "Motivo di accesso, anamnesi prossima e remota, allergie, terapia domiciliare in atto, esame obiettivo mirato e parametri vitali…",
    rows: 5,
    minHint: 20,
  },
  {
    key: "diagnosticFindings",
    code: "B",
    label: "Riscontri Diagnostici e Ragionamento Clinico",
    brief: "Esami eseguiti, referti principali e diagnosi differenziali considerate.",
    placeholder:
      "Esami richiesti e referti principali, interpretazione e diagnosi differenziali che hai scartato o tenuto in gioco…",
    rows: 5,
    minHint: 15,
  },
  {
    key: "diagnosisTreatment",
    code: "C",
    label: "Diagnosi, Terapia e Condotta",
    brief: "Ipotesi o diagnosi finale, posologia e piano terapeutico.",
    placeholder:
      "Diagnosi finale: …\nTerapia (principio, dose, via, durata) e condotta (osservazione, ricovero, dimissione)…",
    rows: 6,
    minHint: 10,
  },
  {
    key: "dischargeNote",
    code: "D",
    label: "Informazione al Paziente, Consenso, Follow-up e Red Flags",
    brief: "Diario di dimissione, segnali d'allarme e presa d'atto del consenso (L. 219/2017).",
    placeholder:
      "Cosa hai spiegato al paziente, consenso informato o presa d'atto, follow-up e red flags per cui tornare subito…",
    rows: 6,
    minHint: 20,
  },
];

function defaultFormalClosure(): string {
  const stamp = new Intl.DateTimeFormat("it-IT", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date());
  return `${stamp} — Medico in formazione`;
}

export function ClinicalDischargeReportPanel({
  sections,
  onChange,
  onConfirm,
  confirmDisabled,
  isAdminExtras,
}: ClinicalDischargeReportPanelProps) {
  const [guideOpen, setGuideOpen] = useState(false);

  const update = (key: keyof ClinicalReportSections, value: string) => {
    onChange({ ...sections, [key]: value });
  };

  const completed = FIELDS.filter((f) => sections[f.key].trim().length >= f.minHint).length;
  const reportComplete = isClinicalReportComplete(sections);
  const closureOn = Boolean(sections.formalClosure?.trim());

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2 border-b border-slate-200 pb-3">
        <div>
          <p className="text-[11px] font-medium text-slate-500">
            Fascicolo di dimissione · sezioni cliniche
          </p>
          <p className="mt-0.5 text-sm text-slate-700">
            <span className="font-semibold tabular-nums text-[#1E324E]">{completed}</span>
            <span className="text-slate-400"> / {FIELDS.length}</span>
            {" "}complete
          </p>
        </div>
        <button
          type="button"
          onClick={() => setGuideOpen((v) => !v)}
          className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 transition hover:text-[#1E324E]"
        >
          Requisiti medico-legali
          <ChevronDown
            className={cn("h-3.5 w-3.5 transition", guideOpen && "rotate-180")}
            strokeWidth={1.75}
          />
        </button>
      </div>

      {guideOpen ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-3 text-xs leading-relaxed text-slate-600">
          <p className="mb-1.5 inline-flex items-center gap-1.5 font-semibold text-slate-800">
            <Scale className="h-3.5 w-3.5 text-[#1E324E]" strokeWidth={1.75} />
            Tutela documentale
          </p>
          <p>
            Requisiti minimi della documentazione clinica (L. 24/2017, L. 219/2017, art. 476–479
            c.p.): anamnesi ed esame obiettivo, riscontri e ragionamento, diagnosi e terapia,
            informazione al paziente con consenso e red flags, chiusura con data e qualifica.
            Le sezioni vuote non bloccano l&apos;invio: l&apos;omissione pesa sulla valutazione.
          </p>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-[#FAFAF9]">
        {FIELDS.map((field, index) => {
          const isLast = field.key === "dischargeNote";
          const value = sections[field.key];
          const len = value.trim().length;
          const ok = len >= field.minHint;
          return (
            <section
              key={field.key}
              className={cn(
                "px-4 py-4",
                index > 0 && "border-t border-slate-200",
              )}
            >
              <div className="mb-2.5 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono text-[11px] font-semibold text-slate-400">
                      §{field.code}
                    </span>
                    <h3 className="text-[13px] font-semibold text-slate-900">{field.label}</h3>
                  </div>
                  <p className="mt-0.5 text-[11px] leading-snug text-slate-500">{field.brief}</p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                    ok
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-slate-100 text-slate-500",
                  )}
                >
                  {len}
                  <span className="font-normal text-slate-400">/{field.minHint}</span>
                </span>
              </div>
              <textarea
                value={value}
                onChange={(e) => update(field.key, e.target.value)}
                rows={field.rows}
                placeholder={field.placeholder}
                className="w-full resize-y rounded-md border border-slate-300 bg-white px-3 py-2.5 font-[family-name:var(--font-inter)] text-[13px] leading-relaxed text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#345884] focus:ring-2 focus:ring-[#345884]/12"
                onKeyDown={
                  isLast
                    ? (event) =>
                        handleTextareaEnterSubmit(event, {
                          getValue: () => sections.dischargeNote,
                          isDisabled: Boolean(confirmDisabled),
                          onSubmit: onConfirm,
                        })
                    : undefined
                }
              />
            </section>
          );
        })}
        <section className="border-t border-slate-200 px-4 py-4">
          <div className="mb-2.5 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-[11px] font-semibold text-slate-400">§E</span>
                <h3 className="text-[13px] font-semibold text-slate-900">
                  Chiusura Formale (Data/Ora e Qualifica/Firma del medico)
                </h3>
              </div>
              <p className="mt-0.5 text-[11px] leading-snug text-slate-500">
                Opzionale e non bloccante. Se la ometti, il valutatore legale vede l&apos;assenza.
              </p>
            </div>
          </div>
          <label className="flex items-start gap-2 text-[13px] text-slate-800">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={closureOn}
              onChange={(event) => {
                update("formalClosure", event.target.checked ? sections.formalClosure?.trim() || defaultFormalClosure() : "");
              }}
            />
            <span>Inserisci data, ora e qualifica nel referto</span>
          </label>
          {closureOn ? (
            <input
              value={sections.formalClosure ?? ""}
              onChange={(event) => update("formalClosure", event.target.value)}
              placeholder="es. 26/11/2026, 08:40 — Medico in formazione"
              className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-[13px] text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#345884] focus:ring-2 focus:ring-[#345884]/12"
            />
          ) : null}
        </section>
      </div>

      {isAdminExtras}

      {!reportComplete ? (
        <div
          role="status"
          className="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3 text-xs leading-relaxed text-amber-950"
        >
          Referto incompleto o vuoto: puoi comunque inviare e chiudere il caso, ma le omissioni
          incideranno negativamente sulla valutazione clinica e medico-legale.
        </div>
      ) : null}

      <div className="flex items-center justify-end gap-3 pt-1">
        <p className="mr-auto hidden max-w-xs text-[11px] leading-snug text-slate-400 sm:block">
          L&apos;invio chiude la compilazione. Poi potrai generare il report finale.
        </p>
        <button
          type="button"
          onClick={onConfirm}
          disabled={confirmDisabled}
          className="inline-flex items-center justify-center rounded-lg bg-[#1E324E] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#2A486D] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
        >
          {reportComplete ? "Conferma referto clinico" : "Invia comunque"}
        </button>
      </div>
    </div>
  );
}
