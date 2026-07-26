"use client";

import { useState } from "react";
import { ChevronDown, Scale } from "lucide-react";
import { cn } from "@/app/utils/cn";
import { handleTextareaEnterSubmit } from "@/lib/hooks/textarea-submit";

export type ClinicalReportSections = {
  anamnesisObjective: string;
  diagnosticFindings: string;
  diagnosisTreatment: string;
};

export function composeClinicalReport(sections: ClinicalReportSections): string {
  const parts: string[] = [];

  if (sections.anamnesisObjective.trim()) {
    parts.push("=== ANAMNESI & ESAME OBIETTIVO ===", sections.anamnesisObjective.trim());
  }
  if (sections.diagnosticFindings.trim()) {
    parts.push("=== RISCONTRI DIAGNOSTICI ===", sections.diagnosticFindings.trim());
  }
  if (sections.diagnosisTreatment.trim()) {
    parts.push("=== DIAGNOSI & TRATTAMENTO DI DIMISSIONE ===", sections.diagnosisTreatment.trim());
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
    sections.diagnosisTreatment.trim().length >= 10
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
  key: keyof ClinicalReportSections;
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
    label: "Anamnesi ed esame obiettivo",
    brief: "Presentazione, cronologia, fattori di rischio, EO mirato e vitali.",
    placeholder:
      "Motivo di accesso, anamnesi prossima e remota, terapie domiciliari, esame obiettivo mirato e parametri vitali…",
    rows: 5,
    minHint: 20,
  },
  {
    key: "diagnosticFindings",
    code: "B",
    label: "Riscontri diagnostici",
    brief: "Laboratorio e imaging con interpretazione, non elenco asettico.",
    placeholder:
      "Esami di laboratorio e strumentali con interpretazione clinica sintetica e correlazione al quadro…",
    rows: 5,
    minHint: 15,
  },
  {
    key: "diagnosisTreatment",
    code: "C",
    label: "Diagnosi e trattamento di dimissione",
    brief: "Diagnosi motivata, terapia in PS, destinazione e follow-up.",
    placeholder:
      "Diagnosi finale motivata; terapia effettuata in PS; indicazioni di dimissione o trasferimento; follow-up e red flags…",
    rows: 6,
    minHint: 10,
  },
];

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
            Valore probatorio (art. 476–479 c.p.): cronologia chiara, nesso sintomo → indagine →
            diagnosi → terapia, aderenza alle linee guida (L. 24/2017 art. 5) ove applicabile.
          </p>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-[#FAFAF9]">
        {FIELDS.map((field, index) => {
          const isLast = field.key === "diagnosisTreatment";
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
                          getValue: () => sections.diagnosisTreatment,
                          isDisabled: Boolean(confirmDisabled),
                          onSubmit: onConfirm,
                        })
                    : undefined
                }
              />
            </section>
          );
        })}
      </div>

      {isAdminExtras}

      <div className="flex items-center justify-end gap-3 pt-1">
        <p className="mr-auto hidden max-w-xs text-[11px] leading-snug text-slate-400 sm:block">
          La conferma chiude il percorso clinico simulato e avvia la valutazione.
        </p>
        <button
          type="button"
          onClick={onConfirm}
          disabled={confirmDisabled}
          className="inline-flex items-center justify-center rounded-lg bg-[#1E324E] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#2A486D] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
        >
          Conferma referto clinico
        </button>
      </div>
    </div>
  );
}
