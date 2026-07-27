"use client";

import { useMemo, useState } from "react";
import {
  Activity,
  ChevronRight,
  Droplets,
  FlaskConical,
  HeartPulse,
  Microscope,
  ScanLine,
  Shield,
  Target,
  TestTube2,
  type LucideIcon,
} from "lucide-react";
import { ExamOrderDialog } from "@/components/simulator/ExamOrderDialog";
import { cn } from "@/app/utils/cn";
import type { ExamClinicalMeta } from "@/lib/exam-default-values";
import type { CaseExamOverride } from "@/lib/exam-values-meta";
import {
  applyExamMeta,
  type ExamMacroCategory,
  type SimulatorExam,
} from "@/lib/simulator/exam-catalog";

type DiagnosticCategoryPanelProps = {
  selectedExamIds: string[];
  onToggleExam: (id: string) => void;
  caseExamValues: Record<string, CaseExamOverride>;
  examCatalog: Record<string, ExamClinicalMeta>;
  examMacroCatalog: ExamMacroCategory[];
  macroFilter: string[];
};

type CategoryVisual = {
  title: string;
  description: string;
  icon: LucideIcon;
  tone: string;
};

const LAB_GROUP_VISUAL: Record<string, CategoryVisual> = {
  chimica: {
    title: "Chimica / flogosi",
    description: "Elettroliti, enzimi, PCR",
    icon: FlaskConical,
    tone: "bg-sky-50 text-sky-600",
  },
  ematologia: {
    title: "Ematologia",
    description: "Emocromo e coagulazione",
    icon: Droplets,
    tone: "bg-rose-50 text-rose-600",
  },
  endocrino: {
    title: "Endocrino",
    description: "Ormoni e metabolismo",
    icon: Activity,
    tone: "bg-amber-50 text-amber-600",
  },
  immuno: {
    title: "Immunologia",
    description: "Autoanticorpi e sierologia",
    icon: Shield,
    tone: "bg-violet-50 text-violet-600",
  },
  micro: {
    title: "Micro / urine",
    description: "Culture, urine, tossicologia",
    icon: Microscope,
    tone: "bg-emerald-50 text-emerald-600",
  },
  tumor: {
    title: "Marcatori tumorali",
    description: "AFP, CEA, PSA e CA",
    icon: Target,
    tone: "bg-orange-50 text-orange-600",
  },
};

const MACRO_VISUAL: Record<string, CategoryVisual> = {
  img: {
    title: "Immagini",
    description: "RX, eco, TC, RM e medicina nucleare",
    icon: ScanLine,
    tone: "bg-amber-50 text-amber-600",
  },
  strum: {
    title: "Strumentale",
    description: "ECG, ecocardio, spirometria e test funzionali",
    icon: HeartPulse,
    tone: "bg-sky-50 text-sky-600",
  },
  endo: {
    title: "Endoscopia",
    description: "EGDS, biopsie e liquidi biologici",
    icon: TestTube2,
    tone: "bg-emerald-50 text-emerald-600",
  },
};

type PickerTarget = {
  id: string;
  title: string;
  description: string;
  exams: SimulatorExam[];
};

type CategoryButton = {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  tone: string;
  exams: SimulatorExam[];
  selectedCount: number;
};

/**
 * Soft icon chips (light fill + clear colour) — same language as Esame obiettivo.
 */
export function DiagnosticCategoryPanel({
  selectedExamIds,
  onToggleExam,
  caseExamValues,
  examCatalog,
  examMacroCatalog,
  macroFilter,
}: DiagnosticCategoryPanelProps) {
  const [target, setTarget] = useState<PickerTarget | null>(null);

  const macros = useMemo(
    () => examMacroCatalog.filter((m) => macroFilter.includes(m.id)),
    [examMacroCatalog, macroFilter],
  );

  const buttons = useMemo((): CategoryButton[] => {
    if (macros.length === 1 && macros[0].id === "lab") {
      const macro = macros[0];
      return macro.groups.map((group) => {
        const visual = LAB_GROUP_VISUAL[group.id] ?? {
          title: group.label,
          description: "Laboratorio",
          icon: FlaskConical,
          tone: "bg-sky-50 text-sky-600",
        };
        return {
          id: `${macro.id}:${group.id}`,
          title: visual.title,
          description: visual.description,
          icon: visual.icon,
          tone: visual.tone,
          exams: group.exams.map((exam) =>
            applyExamMeta(exam, examCatalog, caseExamValues[exam.id]),
          ),
          selectedCount: group.exams.filter((e) => selectedExamIds.includes(e.id)).length,
        };
      });
    }

    return macros.map((macro) => {
      const exams = macro.groups.flatMap((g) =>
        g.exams.map((exam) => applyExamMeta(exam, examCatalog, caseExamValues[exam.id])),
      );
      const visual = MACRO_VISUAL[macro.id] ?? {
        title: macro.label,
        description: `${exams.length} esami`,
        icon: FlaskConical,
        tone: "bg-slate-100 text-slate-600",
      };
      return {
        id: macro.id,
        title: visual.title,
        description: visual.description,
        icon: visual.icon,
        tone: visual.tone,
        exams,
        selectedCount: exams.filter((e) => selectedExamIds.includes(e.id)).length,
      };
    });
  }, [caseExamValues, examCatalog, macros, selectedExamIds]);

  return (
    <div className="space-y-2.5">
      <p className="text-xs leading-relaxed text-slate-500">
        Apri una categoria, cerca e richiedi. I referti compaiono nel recap in alto.
      </p>
      <div className="grid auto-rows-fr grid-cols-1 gap-2 sm:grid-cols-2">
        {buttons.map((btn) => {
          const Icon = btn.icon;
          return (
            <button
              key={btn.id}
              type="button"
              onClick={() =>
                setTarget({
                  id: btn.id,
                  title: btn.title,
                  description: btn.description,
                  exams: btn.exams,
                })
              }
              className="group flex h-full min-h-[4.75rem] items-center gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-left shadow-sm transition hover:border-[#345884]/35 hover:bg-slate-50/60"
            >
              <span
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                  btn.tone,
                )}
              >
                <Icon className="h-4 w-4" strokeWidth={1.75} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold leading-snug text-slate-800">{btn.title}</p>
                <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-slate-500">
                  {btn.selectedCount > 0
                    ? `${btn.selectedCount} richiest${btn.selectedCount === 1 ? "o" : "i"}`
                    : btn.description}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:text-[#345884]" />
            </button>
          );
        })}
      </div>

      <ExamOrderDialog
        open={Boolean(target)}
        onClose={() => setTarget(null)}
        title={target?.title ?? ""}
        description={target?.description}
        exams={target?.exams ?? []}
        selectedExamIds={selectedExamIds}
        onToggleExam={onToggleExam}
        examCatalog={examCatalog}
        caseExamValues={caseExamValues}
      />
    </div>
  );
}
