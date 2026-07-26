"use client";

import { useMemo, useState } from "react";
import {
  BookOpen,
  ChevronDown,
  FileText,
  FileUp,
  Layers,
  Search,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { Badge } from "@/app/ui/badge";
import { Input } from "@/app/ui/input";
import { cn } from "@/app/utils/cn";
import { GuidelineIngestPanel } from "@/components/guidelines/GuidelineIngestPanel";
import {
  deleteGuidelineDocument,
  toggleGuidelineDocument,
} from "@/app/dashboard/guidelines/actions";

export type GuidelinesHubDoc = {
  id: string;
  title: string;
  tags: string[];
  sourceType: string;
  sourceName: string | null;
  chunkCount: number;
  isActive: boolean;
  createdAt: string;
  text?: string;
};

type GuidelinesHubProps = {
  docs: GuidelinesHubDoc[];
  isAdmin: boolean;
  loadError: string | null;
  initialTab?: "browse" | "ingest";
};

/** First readable sentence / line — short lead for a guideline card, not a wall of text. */
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
  const lead = doc.text ? leadSentence(doc.text) : null;
  const hasPreview = Boolean(doc.text?.trim());
  const dateLabel = new Date(doc.createdAt).toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <article
      className={cn(
        "group relative overflow-hidden rounded-2xl border bg-white transition-shadow",
        doc.isActive
          ? "border-slate-200 shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:shadow-md"
          : "border-slate-200/80 bg-slate-50/60 opacity-80",
      )}
    >
      {/* Left accent bar — reads as a document spine */}
      <span
        className={cn(
          "absolute inset-y-0 left-0 w-1",
          doc.isActive ? "bg-[#345884]" : "bg-slate-300",
        )}
        aria-hidden
      />

      <div className="flex gap-4 py-4 pl-5 pr-4 sm:pl-6">
        <div
          className={cn(
            "mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
            doc.isActive
              ? "bg-[#1E324E]/[0.07] text-[#1E324E]"
              : "bg-slate-200/70 text-slate-500",
          )}
        >
          <BookOpen className="h-5 w-5" strokeWidth={1.75} />
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <h2 className="font-display text-[15px] font-semibold leading-snug tracking-tight text-slate-900">
                {doc.title}
              </h2>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500">
                <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 font-medium text-slate-600">
                  <FileText className="h-3 w-3" />
                  {formatSourceType(doc.sourceType)}
                </span>
                {doc.sourceName ? (
                  <>
                    <span className="text-slate-300" aria-hidden>
                      ·
                    </span>
                    <span className="truncate">{doc.sourceName}</span>
                  </>
                ) : null}
                <span className="text-slate-300" aria-hidden>
                  ·
                </span>
                <span className="inline-flex items-center gap-1">
                  <Layers className="h-3 w-3 text-slate-400" />
                  {doc.chunkCount} {doc.chunkCount === 1 ? "sezione" : "sezioni"}
                </span>
                <span className="text-slate-300" aria-hidden>
                  ·
                </span>
                <span>{dateLabel}</span>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <Badge variant={doc.isActive ? "success" : "default"}>
                {doc.isActive ? "Attiva" : "Disabilitata"}
              </Badge>
              {isAdmin ? (
                <>
                  <form action={toggleGuidelineDocument}>
                    <input type="hidden" name="id" value={doc.id} />
                    <button
                      type="submit"
                      className={cn(
                        "relative inline-flex h-6 w-11 items-center rounded-full border transition-colors",
                        doc.isActive
                          ? "border-brand-secondary bg-brand-secondary"
                          : "border-slate-200 bg-slate-100",
                      )}
                      aria-pressed={doc.isActive}
                      title={doc.isActive ? "Disabilita" : "Abilita"}
                    >
                      <span
                        className={cn(
                          "inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform",
                          doc.isActive ? "translate-x-5" : "translate-x-1",
                        )}
                      />
                    </button>
                  </form>
                  <form action={deleteGuidelineDocument}>
                    <input type="hidden" name="id" value={doc.id} />
                    <button
                      type="submit"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
                      title="Elimina documento"
                      aria-label="Elimina documento"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </form>
                </>
              ) : null}
            </div>
          </div>

          {doc.tags.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {doc.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-[#345884]/15 bg-[#345884]/[0.06] px-2.5 py-0.5 text-[11px] font-medium text-[#2A486D]"
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : null}

          {lead ? (
            <p className="text-sm leading-relaxed text-slate-600">{lead}</p>
          ) : null}

          {hasPreview ? (
            <div className="border-t border-slate-100 pt-2">
              <button
                type="button"
                onClick={onToggleExpand}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#345884] transition-colors hover:text-[#1E324E]"
                aria-expanded={expanded}
              >
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 transition-transform",
                    expanded ? "rotate-180" : "rotate-0",
                  )}
                />
                {expanded ? "Nascondi estratto" : "Mostra estratto"}
              </button>
              {expanded ? (
                <div className="mt-2.5 max-h-48 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50/80 px-3.5 py-3 scrollbar-aequan">
                  <pre className="whitespace-pre-wrap font-sans text-[12px] leading-relaxed text-slate-600">
                    {doc.text!.trim().slice(0, 900)}
                    {doc.text!.trim().length > 900 ? "…" : ""}
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
    isAdmin && initialTab === "ingest" ? "ingest" : "browse",
  );
  const [query, setQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return docs;
    return docs.filter((doc) => {
      const haystack = [doc.title, doc.sourceName ?? "", doc.tags.join(" "), doc.text ?? ""]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [docs, query]);

  const activeCount = docs.filter((d) => d.isActive).length;

  return (
    <div className="flex w-full flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1E324E]/[0.08] text-[#1E324E]">
              <BookOpen className="h-5 w-5" strokeWidth={1.75} />
            </span>
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">
                Linee Guida
              </h1>
              <p className="text-sm text-slate-500">
                Archivio clinico usato dal motore RAG nelle simulazioni
                {isAdmin ? " · gestisci e indicizza i documenti" : ""}.
              </p>
            </div>
          </div>
        </div>
        {isAdmin ? (
          <div className="inline-flex rounded-full border border-slate-200 bg-white p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setTab("browse")}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors",
                tab === "browse"
                  ? "bg-brand-primary text-white shadow-sm"
                  : "text-slate-600 hover:text-brand-primary",
              )}
            >
              Archivio
            </button>
            <button
              type="button"
              onClick={() => setTab("ingest")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors",
                tab === "ingest"
                  ? "bg-brand-primary text-white shadow-sm"
                  : "text-slate-600 hover:text-brand-primary",
              )}
            >
              <FileUp className="h-3.5 w-3.5" />
              Carica / Indicizza
            </button>
          </div>
        ) : null}
      </header>

      {tab === "ingest" && isAdmin ? (
        <section className="space-y-3">
          <div>
            <h2 className="font-display text-sm font-semibold text-brand-primary">
              Carica documento RAG
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              PDF o testo → chunking → embeddings Pinecone / Postgres.
            </p>
          </div>
          <GuidelineIngestPanel />
        </section>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <div className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cerca per titolo, tag o contenuto…"
                className="h-10 rounded-full border-slate-200 bg-slate-50 pl-9 text-sm shadow-none"
              />
            </div>
            <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium tabular-nums text-slate-600">
              {loadError
                ? "Archivio non disponibile"
                : query.trim()
                  ? `${filtered.length} risultati`
                  : `${docs.length} documenti · ${activeCount} attivi`}
            </span>
          </div>

          <section className="space-y-3" aria-label="Elenco linee guida">
            {loadError ? (
              <div className="flex flex-col items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50/80 px-5 py-6">
                <div className="flex items-center gap-2 text-rose-800">
                  <ShieldAlert className="h-4 w-4" />
                  <p className="text-sm font-medium">{loadError}</p>
                </div>
                {isAdmin ? (
                  <button
                    type="button"
                    onClick={() => setTab("ingest")}
                    className="inline-flex items-center gap-2 rounded-xl bg-brand-primary px-3 py-2 text-xs font-medium text-white hover:bg-brand-primary-hover"
                  >
                    <FileUp className="h-3.5 w-3.5" />
                    Carica documento
                  </button>
                ) : null}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                  <BookOpen className="h-6 w-6" />
                </span>
                <p className="text-sm font-semibold text-slate-800">
                  {docs.length === 0 ? "Nessuna linea guida caricata" : "Nessun risultato"}
                </p>
                <p className="max-w-md text-xs leading-relaxed text-slate-500">
                  {docs.length === 0
                    ? "L'archivio è vuoto. Un amministratore può caricare PDF o testo da questa pagina."
                    : "Prova a modificare i termini di ricerca."}
                </p>
                {isAdmin && docs.length === 0 ? (
                  <button
                    type="button"
                    onClick={() => setTab("ingest")}
                    className="inline-flex items-center gap-2 rounded-xl bg-brand-primary px-3 py-2 text-xs font-medium text-white hover:bg-brand-primary-hover"
                  >
                    <FileUp className="h-3.5 w-3.5" />
                    Carica documento RAG
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
                  onToggleExpand={() =>
                    setExpandedId((id) => (id === doc.id ? null : doc.id))
                  }
                />
              ))
            )}
          </section>
        </>
      )}
    </div>
  );
}
