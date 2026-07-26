"use client";

import { useMemo, useState } from "react";
import { Check, Search, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/app/ui/dialog";
import { cn } from "@/app/utils/cn";
import { formatExamFinding, type SimulatorExam } from "@/lib/simulator/exam-catalog";
import type { ExamClinicalMeta } from "@/lib/exam-default-values";
import type { CaseExamOverride } from "@/lib/exam-values-meta";

type ExamOrderDialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  exams: SimulatorExam[];
  selectedExamIds: string[];
  onToggleExam: (id: string) => void;
  examCatalog: Record<string, ExamClinicalMeta>;
  caseExamValues: Record<string, CaseExamOverride>;
};

export function ExamOrderDialog({
  open,
  onClose,
  title,
  description,
  exams,
  selectedExamIds,
  onToggleExam,
  examCatalog,
  caseExamValues,
}: ExamOrderDialogProps) {
  const [query, setQuery] = useState("");
  const selectedSet = useMemo(() => new Set(selectedExamIds), [selectedExamIds]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return exams;
    return exams.filter((exam) => exam.name.toLowerCase().includes(q));
  }, [exams, query]);

  if (!open) return null;

  return (
    <Dialog open={open}>
      <DialogContent className="flex max-h-[min(88dvh,640px)] max-w-xl flex-col overflow-hidden p-0">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <DialogHeader className="mb-0 min-w-0">
            <DialogTitle>{title}</DialogTitle>
            {description ? (
              <DialogDescription>{description}</DialogDescription>
            ) : (
              <DialogDescription>
                Cerca e seleziona gli esami da richiedere. Una volta richiesti restano in cartella.
              </DialogDescription>
            )}
          </DialogHeader>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              onClose();
            }}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
            aria-label="Chiudi"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="border-b border-slate-100 px-5 py-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cerca esame…"
              autoFocus
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#345884]/40 focus:bg-white focus:ring-4 focus:ring-[#345884]/10"
            />
          </div>
          <p className="mt-2 text-[11px] text-slate-400">
            {filtered.length} disponibil{filtered.length === 1 ? "e" : "i"}
            {selectedExamIds.length > 0
              ? ` · ${selectedExamIds.filter((id) => exams.some((e) => e.id === id)).length} già richiesti qui`
              : ""}
          </p>
        </div>

        <div className="scrollbar-aequan min-h-0 flex-1 space-y-2 overflow-y-auto px-5 py-4">
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">Nessun esame trovato.</p>
          ) : (
            filtered.map((exam) => {
              const selected = selectedSet.has(exam.id);
              return (
                <button
                  key={exam.id}
                  type="button"
                  onClick={() => onToggleExam(exam.id)}
                  className={cn(
                    "flex w-full flex-col gap-1 rounded-xl border px-3.5 py-3 text-left transition",
                    selected
                      ? "border-[#345884]/35 bg-[#1E324E]/[0.04]"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium text-slate-900">{exam.name}</p>
                    {selected ? (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#1E324E] px-2 py-0.5 text-[10px] font-semibold text-white">
                        <Check className="h-3 w-3" />
                        Richiesto
                      </span>
                    ) : (
                      <span className="shrink-0 text-[11px] tabular-nums text-slate-500">
                        €{exam.cost} · {exam.timeMinutes} min
                      </span>
                    )}
                  </div>
                  {selected ? (
                    <p className="text-xs leading-relaxed text-slate-600">
                      {formatExamFinding(exam.id, examCatalog, caseExamValues)}
                    </p>
                  ) : null}
                </button>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
