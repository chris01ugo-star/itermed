"use client";

import { useRouter } from "next/navigation";
import { Activity, HeartPulse, Thermometer } from "lucide-react";
import { StartCaseButtons } from "@/components/cases/StartCaseButtons";
import type { ClinicalCaseRow } from "@/components/dashboard/ClinicalCaseCard";
import { DIFFICULTY_LABELS, displaySpecialtyName } from "@/lib/dashboard-case-utils";
import { deriveDemoVitals, patientDisplayName } from "@/lib/prassi/demo-vitals";

type PrassiCaseBriefingProps = {
  caseRow: ClinicalCaseRow;
};

export function PrassiCaseBriefing({ caseRow }: PrassiCaseBriefingProps) {
  const router = useRouter();
  const specialty = displaySpecialtyName(caseRow);
  const difficulty = DIFFICULTY_LABELS[caseRow.difficulty] ?? caseRow.difficulty;
  const vitals = deriveDemoVitals(caseRow.id);
  const name = patientDisplayName(caseRow.id, caseRow.title, caseRow.sex);

  const handleSessionStart = (caseId: string, sessionId: string) => {
    router.push(
      `/dashboard/prassi/play/${encodeURIComponent(caseId)}?sessionId=${encodeURIComponent(sessionId)}`,
    );
  };

  return (
    <div className="flex h-full min-h-[480px] flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 p-4 rounded-t-xl">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Identikit paziente
          </p>
          <p className="font-display mt-0.5 text-sm font-semibold text-[#2F4156]">
            Paziente: {name}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-medium text-slate-600">
          <span className="inline-flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5 text-[#345884]" />
            PA: {vitals.bp}
          </span>
          <span className="text-slate-300">•</span>
          <span className="inline-flex items-center gap-1.5">
            <HeartPulse className="h-3.5 w-3.5 text-[#345884]" />
            FC: {vitals.hr} bpm
          </span>
          <span className="text-slate-300">•</span>
          <span>SpO₂: {vitals.spo2}%</span>
          <span className="text-slate-300">•</span>
          <span className="inline-flex items-center gap-1.5">
            <Thermometer className="h-3.5 w-3.5 text-[#345884]" />
            T: {vitals.temp}°C
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-6 p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-[#345884]/10 px-2.5 py-1 text-xs font-medium text-[#345884]">
            {specialty}
          </span>
          <span className="rounded-full border border-amber-100 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800">
            {difficulty}
          </span>
          <span className="rounded-full border border-slate-100 bg-slate-50 px-2.5 py-1 text-xs text-slate-500">
            {caseRow.isGlobal ? "Caso globale" : "Caso individuale"}
          </span>
        </div>

        <div>
          <h2 className="font-display text-xl font-semibold tracking-tight text-[#2F4156]">
            {caseRow.title}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500">
            Simulazione medico-legale con valutazione Gelli-Bianco, appropriatezza prescrittiva e
            sostenibilità SSN. Avvia il caso originale o genera una variante IA per allenarti su
            scenari clinici imprevedibili.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            {
              label: "Anamnesi",
              value: "Dialogo guidato con paziente AI e raccolta sintomi",
            },
            {
              label: "Obiettivi",
              value: "Accuratezza clinica, tutela legale, uso razionale risorse",
            },
            {
              label: "Report",
              value: "Score multi-asse e coaching clinico al termine",
            },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-xl border border-slate-100 bg-slate-50/80 p-4 shadow-sm"
            >
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                {item.label}
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-700">{item.value}</p>
            </div>
          ))}
        </div>

        <div className="mt-auto border-t border-slate-100 pt-5">
          <p className="mb-3 text-xs font-medium text-slate-500">Avvia esercitazione</p>
          <StartCaseButtons caseId={caseRow.id} onSessionStart={handleSessionStart} />
        </div>
      </div>
    </div>
  );
}
