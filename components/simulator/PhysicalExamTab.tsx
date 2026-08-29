"use client";

import { useMemo, useState } from "react";
import {
  Activity,
  Brain,
  Check,
  ChevronRight,
  Search,
  Stethoscope,
  UserRound,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/app/ui/dialog";
import { cn } from "@/app/utils/cn";

type ExamResult = {
  finding: string;
  numericValue: number | null;
};

type ExamState = {
  loading: boolean;
  result?: ExamResult;
  error?: string;
};

type PhysicalExamTabProps = {
  sessionId?: string;
  patientPrompt: string;
  caseId?: string;
  resolveSessionId?: () => Promise<string | null>;
  onExamResult?: (payload: { id: string; label: string; result: ExamResult }) => void;
};

type ExamItem = { id: string; label: string };

type ExamSection = {
  id: string;
  title: string;
  description: string;
  Icon: LucideIcon;
  /** Light fill + clear icon color (cartella: soft, not muddy). */
  tone: string;
  exams: ExamItem[];
};

const SECTIONS: ExamSection[] = [
  {
    id: "general",
    title: "Generale",
    description: "Aspetto, cute, cardiovascolare",
    Icon: UserRound,
    tone: "bg-sky-50 text-sky-600",
    exams: [
      { id: "general-appearance", label: "Esame obiettivo generale" },
      { id: "skin-mucosa", label: "Cute e mucose" },
      { id: "cardiovascular", label: "Apparato cardiovascolare" },
    ],
  },
  {
    id: "thorax",
    title: "Torace",
    description: "Cuore e polmoni",
    Icon: Stethoscope,
    tone: "bg-[#345884]/[0.08] text-[#345884]",
    exams: [
      { id: "cardiac-auscultation", label: "Auscultazione cuore" },
      { id: "lung-auscultation", label: "Auscultazione polmoni" },
    ],
  },
  {
    id: "abdomen",
    title: "Addome",
    description: "Ispezione, palpazione, percussione",
    Icon: Activity,
    tone: "bg-amber-50 text-amber-600",
    exams: [
      { id: "abdomen-inspection", label: "Ispezione addome" },
      { id: "abdomen-palpation", label: "Palpazione addome" },
      { id: "abdomen-percussion", label: "Percussione addome" },
    ],
  },
  {
    id: "neuro",
    title: "Neurologico",
    description: "Pupille, GCS, deficit",
    Icon: Brain,
    tone: "bg-emerald-50 text-emerald-600",
    exams: [
      { id: "pupils", label: "Pupille" },
      { id: "gcs", label: "Glasgow Coma Scale (GCS)" },
      { id: "neuro-deficits", label: "Deficit focali" },
    ],
  },
];

function asLiveSessionId(raw: string | null | undefined): string | undefined {
  if (typeof raw !== "string") return undefined;
  const id = raw.trim();
  if (!id || id.startsWith("registry_")) return undefined;
  return id;
}

export function PhysicalExamTab({
  sessionId,
  patientPrompt,
  caseId,
  resolveSessionId,
  onExamResult,
}: PhysicalExamTabProps) {
  const [exams, setExams] = useState<Record<string, ExamState>>({});
  const [activeSection, setActiveSection] = useState<ExamSection | null>(null);
  const [query, setQuery] = useState("");

  const runExam = async (id: string, label: string) => {
    if (exams[id]?.loading) return;

    setExams((prev) => ({
      ...prev,
      [id]: { loading: true, result: prev[id]?.result, error: undefined },
    }));

    try {
      let liveSessionId = asLiveSessionId(sessionId);

      if (!liveSessionId && resolveSessionId) {
        liveSessionId = asLiveSessionId(await resolveSessionId());
      }

      // Live session preferred; caseId-only is allowed for offline/registry play.
      if (!liveSessionId && !caseId?.trim()) {
        throw new Error(
          "Sessione non disponibile. Accetta il disclaimer e riprova, oppure riavvia il caso.",
        );
      }

      const res = await fetch("/api/examine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(liveSessionId ? { sessionId: liveSessionId } : {}),
          caseId,
          examId: id,
          examType: label,
          patientPrompt,
        }),
      });

      const payload = (await res.json().catch(() => null)) as
        | (ExamResult & { error?: string; code?: string })
        | null;

      if (!res.ok) {
        const detail = payload?.error || payload?.code || `HTTP ${res.status}`;
        throw new Error(String(detail));
      }

      const data = payload as ExamResult;
      if (!data?.finding) {
        throw new Error("Risposta esame non valida.");
      }

      setExams((prev) => ({
        ...prev,
        [id]: { loading: false, result: data },
      }));

      onExamResult?.({ id, label, result: data });
    } catch (err) {
      console.error(err);
      const message =
        err instanceof Error && err.message.trim()
          ? err.message.trim()
          : "Errore nell'esecuzione dell'esame.";
      setExams((prev) => ({
        ...prev,
        [id]: { loading: false, result: prev[id]?.result, error: message },
      }));
    }
  };

  const filteredItems = useMemo(() => {
    if (!activeSection) return [];
    const q = query.trim().toLowerCase();
    if (!q) return activeSection.exams;
    return activeSection.exams.filter((item) => item.label.toLowerCase().includes(q));
  }, [activeSection, query]);

  const doneCount = (section: ExamSection) =>
    section.exams.filter((item) => exams[item.id]?.result).length;

  return (
    <div className="space-y-2.5">
      <p className="text-xs leading-relaxed text-slate-500">
        I vitali sono sul monitor. Qui registri i reperti sistemici — apri una sezione per
        eseguire le manovre.
      </p>

      <div className="grid auto-rows-fr grid-cols-1 gap-2 sm:grid-cols-2">
        {SECTIONS.map((section) => {
          const Icon = section.Icon;
          const done = doneCount(section);
          return (
            <button
              key={section.id}
              type="button"
              onClick={() => {
                setQuery("");
                setActiveSection(section);
              }}
              className="group flex h-full min-h-[4.75rem] items-center gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-left shadow-sm transition hover:border-[#345884]/35 hover:bg-slate-50/60"
            >
              <span
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                  section.tone,
                )}
              >
                <Icon className="h-4 w-4" strokeWidth={1.75} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-800">{section.title}</p>
                <p className="truncate text-[11px] text-slate-500">
                  {done > 0
                    ? `${done}/${section.exams.length} eseguit${done === 1 ? "a" : "e"}`
                    : section.description}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:text-[#345884]" />
            </button>
          );
        })}
      </div>

      <Dialog open={Boolean(activeSection)}>
        <DialogContent className="relative z-[60] flex max-h-[min(88dvh,640px)] max-w-xl flex-col overflow-hidden p-0">
          <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <DialogHeader className="mb-0 min-w-0">
              <DialogTitle>{activeSection?.title ?? "Esame obiettivo"}</DialogTitle>
              <DialogDescription>
                {activeSection?.description ?? "Seleziona una manovra da eseguire."}
              </DialogDescription>
            </DialogHeader>
            <button
              type="button"
              onClick={() => {
                setActiveSection(null);
                setQuery("");
              }}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50"
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
                placeholder="Cerca manovra…"
                autoFocus
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#345884]/40 focus:bg-white focus:ring-4 focus:ring-[#345884]/10"
              />
            </div>
          </div>

          <div className="scrollbar-aequan min-h-0 flex-1 space-y-2 overflow-y-auto px-5 py-4">
            {filteredItems.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">Nessuna manovra trovata.</p>
            ) : (
              filteredItems.map((item) => {
                const state = exams[item.id];
                const loading = Boolean(state?.loading);
                const result = state?.result;
                const error = state?.error;
                return (
                  <div
                    key={item.id}
                    className={cn(
                      "rounded-xl border px-3.5 py-3",
                      result
                        ? "border-emerald-200 bg-emerald-50/50"
                        : error
                          ? "border-rose-200 bg-rose-50/40"
                          : "border-slate-200 bg-white",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-medium text-slate-900">{item.label}</p>
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => runExam(item.id, item.label)}
                        className={cn(
                          "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition",
                          result
                            ? "bg-white text-[#345884] ring-1 ring-slate-200 hover:bg-slate-50"
                            : "bg-[#1E324E] text-white hover:bg-[#2A486D]",
                          loading && "opacity-60",
                        )}
                      >
                        {loading ? (
                          "In corso…"
                        ) : result ? (
                          <>
                            <Check className="h-3.5 w-3.5" />
                            Ripeti
                          </>
                        ) : (
                          "Esegui"
                        )}
                      </button>
                    </div>
                    {error ? (
                      <p className="mt-2 text-sm leading-relaxed text-rose-800">{error}</p>
                    ) : null}
                    {result ? (
                      <p className="mt-2 text-sm leading-relaxed text-slate-700">
                        {result.finding}
                        {typeof result.numericValue === "number" ? (
                          <span className="text-slate-500"> ({result.numericValue})</span>
                        ) : null}
                      </p>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
