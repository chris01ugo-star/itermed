"use client";

import { useMemo, useState } from "react";
import {
  ClipboardList,
  FolderClosed,
  Microscope,
  ScanLine,
  Stethoscope,
  TestTube2,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/app/ui/dialog";
import { cn } from "@/app/utils/cn";
import { PRASSI_PASTELS, PRASSI_TONE } from "@/lib/ui/prassi-pastels";
import {
  formatExamFinding,
  type ExamMacroCategory,
  type SimulatorExam,
} from "@/lib/simulator/exam-catalog";
import type { ExamClinicalMeta } from "@/lib/exam-default-values";
import type { CaseExamOverride } from "@/lib/exam-values-meta";

export type ObjectiveFindingRecap = {
  id: string;
  label: string;
  finding: string;
  numericValue: number | null;
};

type ExamReportRecapProps = {
  exams: SimulatorExam[];
  objectiveFindings: ObjectiveFindingRecap[];
  examCatalog: Record<string, ExamClinicalMeta>;
  caseExamValues: Record<string, CaseExamOverride>;
  examMacroCatalog: ExamMacroCategory[];
  className?: string;
};

type RecapEntry = {
  id: string;
  title: string;
  finding: string;
  meta: string;
  abnormal: boolean;
};

type RecapFolder = {
  id: string;
  title: string;
  kindLabel: string;
  Icon: typeof Stethoscope;
  fill: string;
  border: string;
  entries: RecapEntry[];
  totalCost: number;
};

const MACRO_META: Record<
  string,
  { kindLabel: string; Icon: typeof Stethoscope; paletteIndex: number }
> = {
  obiettivo: { kindLabel: "Clinica", Icon: Stethoscope, paletteIndex: 1 },
  lab: { kindLabel: "Laboratorio", Icon: TestTube2, paletteIndex: 0 },
  img: { kindLabel: "Radiodiagnostica", Icon: ScanLine, paletteIndex: 2 },
  strum: { kindLabel: "Strumentale", Icon: Microscope, paletteIndex: 6 },
  endo: { kindLabel: "Endoscopia", Icon: Microscope, paletteIndex: 3 },
  other: { kindLabel: "Altri", Icon: Microscope, paletteIndex: 5 },
};

function findMacroForExam(
  examId: string,
  examMacroCatalog: ExamMacroCategory[],
): ExamMacroCategory | null {
  for (const macro of examMacroCatalog) {
    if (macro.groups.some((g) => g.exams.some((e) => e.id === examId))) {
      return macro;
    }
  }
  return null;
}

function FolderCard({
  folder,
  active,
  onOpen,
}: {
  folder: RecapFolder;
  active: boolean;
  onOpen: () => void;
}) {
  const Icon = folder.Icon;
  const abnormalCount = folder.entries.filter((e) => e.abnormal).length;

  return (
    <div className="relative w-full pt-2">
      <span
        className="absolute left-2.5 top-2 z-10 h-2 w-8 -translate-y-[calc(100%-1px)] rounded-t-md"
        style={{ backgroundColor: folder.fill }}
        aria-hidden
      />
      <button
        type="button"
        onClick={onOpen}
        style={{
          backgroundColor: folder.fill,
          borderColor: active ? "#1E324E" : folder.border,
        }}
        className={cn(
          "relative flex h-full w-full flex-col gap-1 overflow-hidden rounded-b-xl rounded-tr-xl border px-2.5 py-2 text-left transition-all duration-200 hover:brightness-[0.98]",
          active && "shadow-sm ring-1 ring-[#1E324E]/20",
        )}
      >
        <div className="flex items-start justify-between gap-1.5">
          <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" strokeWidth={1.75} />
          <span className="rounded-md bg-white/55 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-slate-600">
            {folder.entries.length}
          </span>
        </div>
        <p className="line-clamp-2 text-xs font-bold leading-snug text-slate-800">
          {folder.title}
        </p>
        <p className="truncate text-[10px] text-slate-500">{folder.kindLabel}</p>
        {abnormalCount > 0 ? (
          <span
            className="text-[10px] font-semibold"
            style={{ color: PRASSI_TONE.blush.accent }}
          >
            {abnormalCount} patologic{abnormalCount === 1 ? "o" : "i"}
          </span>
        ) : folder.totalCost > 0 ? (
          <span className="text-[10px] font-medium text-slate-500">
            €{folder.totalCost.toFixed(0)}
          </span>
        ) : (
          <span className="text-[10px] text-slate-400">Apri</span>
        )}
      </button>
    </div>
  );
}

/**
 * Live recap of objective findings + prescribed exams, grouped by clinical category.
 * Two-column folder grid; empty state fills the panel.
 */
export function ExamReportRecap({
  exams,
  objectiveFindings,
  examCatalog,
  caseExamValues,
  examMacroCatalog,
  className,
}: ExamReportRecapProps) {
  const [openId, setOpenId] = useState<string | null>(null);

  const folders = useMemo((): RecapFolder[] => {
    const result: RecapFolder[] = [];

    if (objectiveFindings.length > 0) {
      const meta = MACRO_META.obiettivo;
      const palette = PRASSI_PASTELS[meta.paletteIndex];
      result.push({
        id: "obiettivo",
        title: "Esame obiettivo",
        kindLabel: meta.kindLabel,
        Icon: meta.Icon,
        fill: palette.fill,
        border: palette.border,
        totalCost: 0,
        entries: objectiveFindings.map((f) => ({
          id: f.id,
          title: f.label,
          meta:
            f.numericValue != null
              ? `Valore numerico: ${f.numericValue}`
              : "Manovra eseguita",
          finding: f.finding?.trim() || "Nessun reperto registrato.",
          abnormal: false,
        })),
      });
    }

    const byMacro = new Map<string, { macro: ExamMacroCategory; exams: SimulatorExam[] }>();
    for (const exam of exams) {
      const macro = findMacroForExam(exam.id, examMacroCatalog);
      const key = macro?.id ?? "other";
      const existing = byMacro.get(key);
      if (existing) {
        existing.exams.push(exam);
      } else {
        byMacro.set(key, {
          macro: macro ?? {
            id: "other",
            label: "Altri esami",
            groups: [],
          },
          exams: [exam],
        });
      }
    }

    const order = ["lab", "img", "strum", "endo", "other"];
    const sortedKeys = [...byMacro.keys()].sort((a, b) => {
      const ia = order.indexOf(a);
      const ib = order.indexOf(b);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });

    for (const key of sortedKeys) {
      const bucket = byMacro.get(key)!;
      const meta = MACRO_META[key] ?? MACRO_META.other;
      const palette = PRASSI_PASTELS[meta.paletteIndex];
      result.push({
        id: `macro-${key}`,
        title: bucket.macro.label,
        kindLabel: meta.kindLabel,
        Icon: meta.Icon,
        fill: palette.fill,
        border: palette.border,
        totalCost: bucket.exams.reduce((sum, e) => sum + e.cost, 0),
        entries: bucket.exams.map((exam) => ({
          id: exam.id,
          title: exam.name,
          meta: `€${exam.cost.toFixed(0)} · ${exam.timeMinutes} min`,
          finding: formatExamFinding(exam.id, examCatalog, caseExamValues),
          abnormal: Boolean(caseExamValues[exam.id]?.isAbnormal),
        })),
      });
    }

    return result;
  }, [caseExamValues, examCatalog, examMacroCatalog, exams, objectiveFindings]);

  const openFolder = folders.find((f) => f.id === openId) ?? null;
  const totalEntries = folders.reduce((n, f) => n + f.entries.length, 0);

  return (
    <section
      className={cn(
        "flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm",
        className,
      )}
      aria-label="Recap esami e referti"
    >
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#EEF2F9] text-[#345884]">
            <ClipboardList className="h-4 w-4" strokeWidth={1.75} />
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-800">Recap esami e referti</p>
            <p className="text-[11px] text-slate-500">
              Cartelle compatte — clicca per aprire i referti
            </p>
          </div>
        </div>
        {totalEntries > 0 ? (
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium tabular-nums text-slate-600">
            {folders.length} cartell{folders.length === 1 ? "a" : "e"} · {totalEntries}{" "}
            {totalEntries === 1 ? "esame" : "esami"}
          </span>
        ) : null}
      </div>

      <div className="scrollbar-aequan flex min-h-0 flex-1 flex-col overflow-y-auto px-3 py-3 sm:px-4">
        {folders.length === 0 ? (
          <div className="flex h-full min-h-0 flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-8 text-center">
            <FolderClosed className="h-6 w-6 text-slate-300" />
            <p className="text-sm font-medium text-slate-600">Nessun esame ancora richiesto</p>
            <p className="max-w-[16rem] text-[11px] leading-relaxed text-slate-400">
              Quando esegui manovre o prescrivi esami, le cartelle di categoria compaiono qui.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-2 gap-y-1 content-start">
            {folders.map((folder) => (
              <FolderCard
                key={folder.id}
                folder={folder}
                active={openId === folder.id}
                onOpen={() => setOpenId(folder.id)}
              />
            ))}
          </div>
        )}
      </div>

      <Dialog open={Boolean(openFolder)}>
        <DialogContent className="flex max-h-[min(88dvh,640px)] max-w-xl flex-col overflow-hidden p-0">
          {openFolder ? (
            <>
              <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
                <DialogHeader className="mb-0 min-w-0 text-left">
                  <DialogTitle className="text-base text-slate-900">{openFolder.title}</DialogTitle>
                  <DialogDescription className="text-xs text-slate-500">
                    {openFolder.kindLabel} · {openFolder.entries.length}{" "}
                    {openFolder.entries.length === 1 ? "voce" : "voci"}
                    {openFolder.totalCost > 0
                      ? ` · €${openFolder.totalCost.toFixed(0)}`
                      : ""}
                  </DialogDescription>
                </DialogHeader>
                <button
                  type="button"
                  onClick={() => setOpenId(null)}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
                  aria-label="Chiudi"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <ul className="scrollbar-aequan min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-4 sm:px-5">
                {openFolder.entries.map((entry) => (
                  <li
                    key={entry.id}
                    className="rounded-xl border border-slate-100 bg-slate-50/60 px-3.5 py-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="text-sm font-medium text-slate-900">{entry.title}</p>
                      {entry.abnormal ? (
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                          style={{
                            backgroundColor: PRASSI_TONE.blush.fill,
                            color: PRASSI_TONE.blush.accent,
                            border: `1px solid ${PRASSI_TONE.blush.border}`,
                          }}
                        >
                          Patologico
                        </span>
                      ) : null}
                    </div>
                    {entry.meta ? (
                      <p className="mt-0.5 text-[11px] text-slate-400">{entry.meta}</p>
                    ) : null}
                    <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                      {entry.finding}
                    </p>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}
