"use client";

import { useEffect } from "react";
import {
  Activity,
  HeartPulse,
  Thermometer,
  Droplets,
  Play,
  X,
} from "lucide-react";
import { StartCaseButtons } from "@/components/cases/StartCaseButtons";
import type { ClinicalCaseRow } from "@/components/dashboard/ClinicalCaseCard";
import { DIFFICULTY_LABELS, displaySpecialtyName } from "@/lib/dashboard-case-utils";
import { deriveDemoVitals, patientDisplayName, estimateAgeFromTitle } from "@/lib/prassi/demo-vitals";
import type { PrassiPastel } from "@/lib/ui/prassi-pastels";
import { specialtyPastel } from "@/lib/ui/prassi-pastels";

type PrassiCaseBriefingProps = {
  caseRow: ClinicalCaseRow;
  /** When set, renders as a modal dialog. */
  open?: boolean;
  onClose?: () => void;
  pastel?: PrassiPastel;
};

function BriefingBody({
  caseRow,
  dept,
}: {
  caseRow: ClinicalCaseRow;
  dept: PrassiPastel;
}) {
  const specialty = displaySpecialtyName(caseRow);
  const difficulty = DIFFICULTY_LABELS[caseRow.difficulty] ?? caseRow.difficulty;
  const vitals = deriveDemoVitals(caseRow.id);
  const name = patientDisplayName(caseRow.id, caseRow.title, caseRow.sex);
  const age = caseRow.age ?? estimateAgeFromTitle(caseRow.title);

  return (
    <div className="flex flex-col">
      <div
        className="relative overflow-hidden rounded-xl border px-5 py-4 md:px-6 md:py-5"
        style={{ backgroundColor: dept.fill, borderColor: dept.border }}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Cartella clinica
            </p>
            <h2 className="font-display text-xl font-bold tracking-tight text-text-primary md:text-[1.35rem]">
              {name}
              <span className="font-semibold text-slate-500"> · {age} anni</span>
            </h2>
            <p className="text-sm leading-relaxed text-slate-600">{caseRow.title}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="rounded-lg border bg-white/70 px-2.5 py-1 text-xs font-medium text-slate-700"
              style={{ borderColor: dept.border }}
            >
              {specialty}
            </span>
            <span className="rounded-lg border border-amber-200/80 bg-amber-50/90 px-2.5 py-1 text-xs font-medium text-amber-900">
              {difficulty}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-5">
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            Parametri all&apos;ingresso
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { icon: Activity, label: "PA", value: vitals.bp },
              { icon: HeartPulse, label: "FC", value: `${vitals.hr} bpm` },
              { icon: Droplets, label: "SpO₂", value: `${vitals.spo2}%` },
              { icon: Thermometer, label: "T", value: `${vitals.temp}°C` },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  className="rounded-xl border border-border bg-ui-bg/50 px-3 py-2.5"
                >
                  <div className="flex items-center gap-1.5 text-brand-secondary">
                    <Icon className="h-3.5 w-3.5" aria-hidden />
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      {item.label}
                    </span>
                  </div>
                  <p className="mt-1 font-display text-sm font-semibold tabular-nums text-text-primary">
                    {item.value}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border border-border border-l-[3px] border-l-brand-primary bg-ui-bg/40 px-4 py-3.5">
          <p className="text-xs font-semibold text-brand-primary">Cosa farai in sessione</p>
          <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-slate-600">
            <li>Dialoghi con il paziente e raccogli l&apos;anamnesi.</li>
            <li>Richiedi esami e imaging rispettando budget e linee guida.</li>
            <li>Chiudi il caso: ricevi score e coaching sui cinque pilastri.</li>
          </ul>
        </div>

        <div className="border-t border-border-subtle pt-5">
          <div className="mb-3 flex items-center gap-2">
            <Play className="h-3.5 w-3.5 text-brand-secondary" aria-hidden />
            <p className="text-xs font-semibold text-slate-600">Avvia esercitazione</p>
          </div>
          <StartCaseButtons caseId={caseRow.id} emphasis="original" />
        </div>
      </div>
    </div>
  );
}

/** Inline briefing (legacy) or modal when `open` / `onClose` are provided. */
export function PrassiCaseBriefing({
  caseRow,
  open,
  onClose,
  pastel,
}: PrassiCaseBriefingProps) {
  const specialty = displaySpecialtyName(caseRow);
  const dept = pastel ?? specialtyPastel(specialty);
  const name = patientDisplayName(caseRow.id, caseRow.title, caseRow.sex);
  const isModal = open !== undefined || Boolean(onClose);

  useEffect(() => {
    if (!isModal || !open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [isModal, open, onClose]);

  if (isModal) {
    if (!open) return null;
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/55 p-4 sm:p-6"
        role="presentation"
        onClick={onClose}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Brief — ${name}`}
          className="relative my-auto w-full max-w-2xl max-h-[min(90dvh,720px)] overflow-y-auto rounded-xl border border-border bg-panel-bg p-5 shadow-[0_24px_80px_rgba(0,0,0,0.35)] sm:p-6"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 z-10 rounded-lg p-1.5 text-slate-400 transition hover:bg-ui-bg hover:text-slate-700"
            aria-label="Chiudi"
          >
            <X className="h-4 w-4" />
          </button>
          <BriefingBody caseRow={caseRow} dept={dept} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-[480px] flex-col">
      <BriefingBody caseRow={caseRow} dept={dept} />
    </div>
  );
}
