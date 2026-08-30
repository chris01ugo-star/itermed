"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  ChevronDown,
  FileText,
  FileUp,
  Search,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { Input } from "@/app/ui/input";
import { cn } from "@/app/utils/cn";
import {
  deleteGuidelineDocument,
  toggleGuidelineDocument,
} from "@/app/dashboard/guidelines/actions";

const GuidelineIngestPanel = dynamic(
  () =>
    import("@/components/guidelines/GuidelineIngestPanel").then((m) => m.GuidelineIngestPanel),
  {
    ssr: false,
    loading: () => (
      <div className="h-64 animate-pulse rounded-2xl border border-slate-100 bg-white" />
    ),
  },
);

export type GuidelinesHubDoc = {
  id: string;
  title: string;
  tags: string[];
  sourceType: string;
  sourceName: string | null;
  chunkCount: number;
  isActive: boolean;
  createdAt: string;
  /** Short body excerpt (not full document text). */
  excerpt?: string;
};

type GuidelinesHubProps = {
  docs: GuidelinesHubDoc[];
  isAdmin: boolean;
  loadError: string | null;
  initialTab?: "browse" | "ingest";
};

/** First readable sentence / line — short lead for a guideline card. */
function leadSentence(text: string, max = 140): string | null {
  const cleaned = text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .find((line) => !/^(sintesi|regole|esempi|riconoscimento|azioni|note)\s*:?\s*$/i.test(line));

  if (!cleaned) return null;
  const sentence = cleaned.replace(/\s+/g, " ");
  if (sentence.length <= max) return sentence;
  return `${sentence.slice(0, max).trim()}…`;
}

function formatSourceType(sourceType: string): string {
  const t = sourceType.trim().toUpperCase();
  if (t === "PDF") return "PDF";
  if (t === "TEXT" || t === "TXT") return "Testo";
  return sourceType;
}

function GuidelineCard({
  doc,
  isAdmin,
  expanded,
  onToggleExpand,
}: {
  doc: GuidelinesHubDoc;
  isAdmin: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
}) {
  const body = doc.excerpt?.trim() ?? "";
  const lead = body ? leadSentence(body, 180) : null;
  const hasPreview = Boolean(body);
  const dateLabel = new Date(doc.createdAt).toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <article
      className={cn(
        "bg-white transition-colors",
        doc.isActive ? "hover:bg-[#FAFBFC]" : "bg-slate-50/50 opacity-80",
      )}
    >
      <div className="flex gap-0">
        <div
          className={cn(
            "flex w-14 shrink-0 flex-col items-center justify-start border-r border-slate-100 py-4",
            doc.isActive ? "bg-[#F7F9FC]" : "bg-slate-50",
          )}
        >
          <span
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-md border text-[10px] font-bold uppercase tracking-wide",
              doc.isActive
                ? "border-[#345884]/20 bg-white text-[#345884]"
                : "border-slate-200 bg-white text-slate-400",
            )}
            title={formatSourceType(doc.sourceType)}
          >
            {formatSourceType(doc.sourceType) === "PDF" ? (
              <FileText className="h-4 w-4" strokeWidth={1.5} />
            ) : (
              formatSourceType(doc.sourceType).slice(0, 3)
            )}
          </span>
        </div>

        <div className="min-w-0 flex-1 px-4 py-4 sm:px-5">
          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                <h2 className="font-display text-[15px] font-semibold leading-snug tracking-tight text-[#152437]">
                  {doc.title}
                </h2>
                <span
                  className={cn(
                    "inline-flex items-center text-[10px] font-semibold uppercase tracking-[0.12em]",
                    doc.isActive ? "text-emerald-700" : "text-slate-400",
                  )}
                >
                  {doc.isActive ? "Attiva" : "Disabilitata"}
                </span>
              </div>

              <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] leading-relaxed text-slate-500">
                {doc.sourceName ? <span className="truncate font-medium text-slate-600">{doc.sourceName}</span> : null}
                {doc.sourceName ? <span className="text-slate-300">|</span> : null}
                <span>
                  {doc.chunkCount} {doc.chunkCount === 1 ? "sezione" : "sezioni"}
                </span>
                <span className="text-slate-300">|</span>
                <span>Caricato {dateLabel}</span>
              </p>

              {doc.tags.length > 0 ? (
                <p className="text-[11px] leading-relaxed text-slate-500">
                  <span className="font-medium text-slate-600">Classificazione:</span>{" "}
                  {doc.tags.join(" · ")}
                </p>
              ) : null}
            </div>

            {isAdmin ? (
              <div className="flex shrink-0 items-center gap-1.5">
                <form action={toggleGuidelineDocument}>
                  <input type="hidden" name="id" value={doc.id} />
                  <button
                    type="submit"
                    className={cn(
                      "h-8 rounded-md border px-2.5 text-[11px] font-medium transition",
                      doc.isActive
                        ? "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                        : "border-[#345884]/25 bg-[#EEF2F9] text-[#345884] hover:bg-[#345884] hover:text-white",
                    )}
                    aria-pressed={doc.isActive}
                    title={doc.isActive ? "Disabilita" : "Abilita"}
                  >
                    {doc.isActive ? "Disabilita" : "Abilita"}
                  </button>
                </form>
                <form action={deleteGuidelineDocument}>
                  <input type="hidden" name="id" value={doc.id} />
                  <button
                    type="submit"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-400 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
                    title="Elimina documento"
                    aria-label="Elimina documento"
                  >
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                  </button>
                </form>
              </div>
            ) : null}
          </div>

          {lead ? (
            <p className="mt-3 border-l border-slate-200 pl-3 text-[13px] leading-relaxed text-slate-600">
              {lead}
            </p>
          ) : null}

          {hasPreview ? (
            <div className="mt-3">
              <button
                type="button"
                onClick={onToggleExpand}
                className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#345884] transition hover:text-[#1E324E]"
                aria-expanded={expanded}
              >
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 transition-transform",
                    expanded ? "rotate-180" : "rotate-0",
                  )}
                />
                {expanded ? "Chiudi estratto" : "Apri estratto"}
              </button>
              {expanded ? (
                <div className="mt-2 max-h-52 overflow-y-auto border border-slate-200 bg-[#FAFBFC] px-3.5 py-3 scrollbar-aequan">
                  <pre className="whitespace-pre-wrap font-sans text-[12px] leading-relaxed text-slate-600">
                    {body}
                    {body.length >= 900 ? "…" : ""}
                  </pre>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export function GuidelinesHub({
  docs,
  isAdmin,
  loadError,
  initialTab = "browse",
}: GuidelinesHubProps) {
  const [tab, setTab] = useState<"browse" | "ingest">(
    initialTab === "ingest" ? "ingest" : "browse",
  );
  const [query, setQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return docs;
    return docs.filter((doc) => {
      const haystack = [doc.title, doc.sourceName ?? "", doc.tags.join(" "), doc.excerpt ?? ""]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [docs, query]);

  const activeCount = docs.filter((d) => d.isActive).length;

  if (tab === "ingest") {
    return (
      <div className="flex w-full flex-col gap-5">
        <header className="space-y-1">
          <button
            type="button"
            onClick={() => setTab("browse")}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-[#345884]"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
            Torna all&apos;archivio
          </button>
          <h1 className="font-display text-2xl font-bold tracking-tight text-[#1E324E]">
            Carica documento
          </h1>
          <p className="text-sm text-slate-500">
            Indicizza PDF o testo nel corpus RAG delle linee guida.
          </p>
        </header>
        <GuidelineIngestPanel />
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 text-[#345884]">
            <BookOpen className="h-4 w-4" strokeWidth={1.75} />
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em]">
              Knowledge base
            </span>
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-[#1E324E] md:text-[28px]">
            Linee guida
          </h1>
          <p className="max-w-xl text-sm leading-relaxed text-slate-500">
            Archivio normativo e clinico usato dal motore RAG per valutare le simulazioni.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setTab("ingest")}
          className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl bg-[#1E324E] px-4 text-sm font-semibold text-white transition hover:bg-[#345884]"
        >
          <FileUp className="h-4 w-4" strokeWidth={1.75} />
          Carica documento
        </button>
      </header>

      <div className="flex flex-wrap items-center gap-2.5 rounded-2xl border border-slate-200/80 bg-white px-3 py-2.5 shadow-[0_1px_0_rgba(15,23,42,0.03)] sm:px-4">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cerca per titolo, tag o estratto…"
            className="h-10 rounded-xl border-slate-200 bg-slate-50 pl-9 text-sm shadow-none"
          />
        </div>
        <span className="shrink-0 rounded-lg bg-slate-50 px-3 py-1.5 text-xs font-medium tabular-nums text-slate-600">
          {loadError
            ? "Archivio non disponibile"
            : query.trim()
              ? `${filtered.length} risultati`
              : `${docs.length} documenti · ${activeCount} attivi`}
        </span>
      </div>

      <section className="divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white" aria-label="Elenco linee guida">
        {loadError ? (
          <div className="flex flex-col items-start gap-3 px-5 py-6">
            <div className="flex items-center gap-2 text-rose-800">
              <ShieldAlert className="h-4 w-4" />
              <p className="text-sm font-medium">{loadError}</p>
            </div>
            <button
              type="button"
              onClick={() => setTab("ingest")}
              className="inline-flex items-center gap-2 rounded-xl bg-[#1E324E] px-3 py-2 text-xs font-medium text-white hover:bg-[#345884]"
            >
              <FileUp className="h-3.5 w-3.5" />
              Carica documento
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-[#345884]">
              <BookOpen className="h-5 w-5" strokeWidth={1.75} />
            </span>
            <p className="text-sm font-semibold text-slate-800">
              {docs.length === 0 ? "Nessuna linea guida caricata" : "Nessun risultato"}
            </p>
            <p className="max-w-md text-xs leading-relaxed text-slate-500">
              {docs.length === 0
                ? "L'archivio è vuoto. Carica un PDF o un testo per indicizzarlo nel motore RAG."
                : "Prova a modificare i termini di ricerca."}
            </p>
            {docs.length === 0 ? (
              <button
                type="button"
                onClick={() => setTab("ingest")}
                className="inline-flex items-center gap-2 rounded-xl bg-[#1E324E] px-4 py-2 text-sm font-semibold text-white hover:bg-[#345884]"
              >
                <FileUp className="h-4 w-4" />
                Carica documento
              </button>
            ) : null}
          </div>
        ) : (
          filtered.map((doc) => (
            <GuidelineCard
              key={doc.id}
              doc={doc}
              isAdmin={isAdmin}
              expanded={expandedId === doc.id}
              onToggleExpand={() => setExpandedId((id) => (id === doc.id ? null : doc.id))}
            />
          ))
        )}
      </section>
    </div>
  );
}
