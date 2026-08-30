"use client";

import { useMemo, useCallback, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ChevronRight,
  FolderOpen,
  MessageSquare,
  Stethoscope,
} from "lucide-react";
import {
  DIFFICULTY_LABELS,
  displaySpecialtyName,
  isCaseDifficulty,
  type CaseDifficulty,
} from "@/lib/dashboard-case-utils";
import { cn } from "@/app/utils/cn";
import type { ClinicalCaseRow } from "@/components/dashboard/ClinicalCaseCard";
import { estimateAgeFromTitle, patientDisplayName } from "@/lib/prassi/demo-vitals";
import {
  assignSpecialtyPastels,
  nestPastel,
  type PrassiPastel,
} from "@/lib/ui/prassi-pastels";
import { PrassiCaseBriefing } from "@/components/prassi/PrassiCaseBriefing";

type SpecialtyOption = {
  id: string;
  name: string;
};

type PrassiShellProps = {
  cases: ClinicalCaseRow[];
  specialties?: SpecialtyOption[];
  /** @deprecated Shell is now self-contained; children ignored outside play. */
  children?: ReactNode;
};

function conditionFromTitle(title?: string | null): string {
  const raw = (title ?? "").trim();
  if (!raw) return "Caso clinico";
  const stripped = raw.replace(/^(uomo|donna)\s+\d{1,3}\s*anni?\s*(con\s+)?/i, "").trim();
  if (!stripped) return raw;
  return stripped.charAt(0).toUpperCase() + stripped.slice(1);
}

const DIFFICULTY_TONE: Record<CaseDifficulty, string> = {
  EASY: "text-emerald-700",
  MEDIUM: "text-amber-800",
  HARD: "text-rose-700",
};

type SpecialtyBucket = {
  name: string;
  cases: ClinicalCaseRow[];
  pastel: PrassiPastel;
};

function difficultyMix(cases: ClinicalCaseRow[]): string {
  let easy = 0;
  let medium = 0;
  let hard = 0;
  for (const c of cases) {
    const d = isCaseDifficulty(c.difficulty) ? c.difficulty : "MEDIUM";
    if (d === "EASY") easy += 1;
    else if (d === "HARD") hard += 1;
    else medium += 1;
  }
  const parts: string[] = [];
  if (easy) parts.push(`${easy} facil${easy === 1 ? "e" : "i"}`);
  if (medium) parts.push(`${medium} medi`);
  if (hard) parts.push(`${hard} difficil${hard === 1 ? "e" : "i"}`);
  return parts.join(" · ") || "Mix difficoltà";
}

function FolderNotch({ fill }: { fill: string }) {
  return (
    <span
      className="absolute left-3 top-0 z-10 h-2.5 w-11 -translate-y-[calc(100%-1px)] rounded-t-md"
      style={{ backgroundColor: fill }}
      aria-hidden
    />
  );
}

const HOW_STEPS = [
  {
    icon: FolderOpen,
    title: "Apri una cartella",
    body: "Scegli la specialità da esercitare.",
  },
  {
    icon: Stethoscope,
    title: "Leggi il brief",
    body: "Controlla paziente, difficoltà e contesto.",
  },
  {
    icon: MessageSquare,
    title: "Avvia la simulazione",
    body: "Dialoga, richiedi esami e chiudi il caso.",
  },
] as const;

export function PrassiShell({ cases, specialties = [] }: PrassiShellProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const openSpecialty = searchParams?.get("specialty")?.trim() || null;
  const openCaseId = searchParams?.get("caseId")?.trim() || null;

  const safeCases = useMemo(
    () => (Array.isArray(cases) ? cases.filter((c) => c?.id) : []),
    [cases],
  );

  const buckets = useMemo(() => {
    const byName = new Map<string, ClinicalCaseRow[]>();

    for (const row of safeCases) {
      const name = displaySpecialtyName(row) || "Altro";
      const list = byName.get(name) ?? [];
      list.push(row);
      byName.set(name, list);
    }

    for (const s of specialties) {
      if (s?.name && !byName.has(s.name)) byName.set(s.name, []);
    }

    const names = Array.from(byName.keys());
    const pastelMap = assignSpecialtyPastels(names);

    const result: SpecialtyBucket[] = names
      .map((name) => ({
        name,
        cases: (byName.get(name) ?? []).slice().sort((a, b) =>
          (a.title ?? "").localeCompare(b.title ?? "", "it"),
        ),
        pastel: pastelMap.get(name)!,
      }))
      .filter((b) => b.cases.length > 0)
      .sort((a, b) => a.name.localeCompare(b.name, "it"));

    return result;
  }, [safeCases, specialties]);

  const activeBucket = openSpecialty
    ? buckets.find((b) => b.name.toLowerCase() === openSpecialty.toLowerCase()) ?? null
    : null;

  const selectedCase =
    openCaseId && activeBucket
      ? activeBucket.cases.find((c) => c.id === openCaseId) ?? null
      : openCaseId
        ? safeCases.find((c) => c.id === openCaseId) ?? null
        : null;

  const setParams = useCallback(
    (next: { specialty?: string | null; caseId?: string | null }) => {
      const params = new URLSearchParams();
      const specialty =
        next.specialty !== undefined ? next.specialty : openSpecialty;
      const caseId = next.caseId !== undefined ? next.caseId : openCaseId;
      if (specialty) params.set("specialty", specialty);
      if (caseId) params.set("caseId", caseId);
      const qs = params.toString();
      router.replace(qs ? `/dashboard/prassi?${qs}` : "/dashboard/prassi", {
        scroll: false,
      });
    },
    [router, openSpecialty, openCaseId],
  );

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-3 bg-[#F4F6F8] px-4 pb-4 pt-3 md:gap-4 md:px-6 md:pb-6 md:pt-4">
      <header className="shrink-0 space-y-3">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#345884]">
            Libreria casi
          </p>
          <h1 className="font-display text-[1.55rem] font-bold tracking-tight text-text-primary md:text-[1.7rem]">
            Casi Clinici
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-slate-500">
            {activeBucket
              ? "Scegli un caso e apri la cartella per avviare la simulazione."
              : "Apri una specialità, poi scegli il caso clinico da esercitare."}
          </p>
        </div>

        {!activeBucket && buckets.length > 0 ? (
          <>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-xl border border-slate-200/90 bg-white px-3.5 py-2.5">
                <p className="text-[11px] text-slate-500">Specialità</p>
                <p className="mt-0.5 text-sm font-semibold tabular-nums text-[#1E324E]">
                  {buckets.length}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200/90 bg-white px-3.5 py-2.5">
                <p className="text-[11px] text-slate-500">Casi totali</p>
                <p className="mt-0.5 text-sm font-semibold tabular-nums text-[#1E324E]">
                  {safeCases.length}
                </p>
              </div>
              <div className="col-span-2 rounded-xl border border-slate-200/90 bg-white px-3.5 py-2.5 sm:col-span-2">
                <p className="text-[11px] text-slate-500">Come funziona</p>
                <p className="mt-0.5 text-sm font-medium text-slate-700">
                  Cartella → brief → simulazione
                </p>
              </div>
            </div>

            <ol className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {HOW_STEPS.map((step, index) => {
                const Icon = step.icon;
                return (
                  <li
                    key={step.title}
                    className="flex items-start gap-3 rounded-xl border border-slate-200/80 bg-white/80 px-3.5 py-3"
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#1E324E] text-[11px] font-bold text-white">
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-[#345884]">
                        <Icon className="h-3.5 w-3.5" aria-hidden />
                        <p className="text-xs font-semibold text-slate-800">{step.title}</p>
                      </div>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
                        {step.body}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </>
        ) : null}
      </header>

      <div className="scrollbar-aequan min-h-0 flex-1 overflow-y-auto rounded-xl border border-border bg-panel-bg p-3.5 shadow-aequan-panel sm:p-4 md:p-5">
        {activeBucket ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setParams({ specialty: null, caseId: null })}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-ui-bg/70 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-brand-primary/30 hover:text-brand-primary"
              >
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
                Tutte le specialità
              </button>
              <div className="min-w-0">
                <p className="font-display text-lg font-bold tracking-tight text-text-primary">
                  {activeBucket.name}
                </p>
                <p className="text-xs text-slate-500">
                  {activeBucket.cases.length === 1
                    ? "1 caso"
                    : `${activeBucket.cases.length} casi`}
                  {" · "}
                  {difficultyMix(activeBucket.cases)}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {activeBucket.cases.map((caseRow) => {
                const difficultyKey = isCaseDifficulty(caseRow.difficulty)
                  ? caseRow.difficulty
                  : "MEDIUM";
                const difficultyLabel =
                  DIFFICULTY_LABELS[difficultyKey] ??
                  String(caseRow.difficulty ?? "Media");
                const patientName = patientDisplayName(
                  caseRow.id,
                  caseRow.title,
                  caseRow.sex,
                );
                const patientAge = caseRow.age ?? estimateAgeFromTitle(caseRow.title);
                const condition = conditionFromTitle(caseRow.title);
                const dept = nestPastel(activeBucket.pastel);
                const isSelected = openCaseId === caseRow.id;

                return (
                  <div key={caseRow.id} className="relative pt-2.5">
                    <FolderNotch fill={dept.fill} />
                    <button
                      type="button"
                      onClick={() =>
                        setParams({
                          specialty: activeBucket.name,
                          caseId: caseRow.id,
                        })
                      }
                      style={{
                        backgroundColor: dept.fill,
                        borderColor: isSelected ? "#1E324E" : dept.border,
                      }}
                      className={cn(
                        "group relative flex h-[6.75rem] w-full min-w-0 items-stretch gap-2 overflow-hidden rounded-b-xl rounded-tr-xl border px-3.5 py-3 text-left transition duration-200",
                        "hover:brightness-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/30",
                        isSelected ? "shadow-aequan-panel ring-1 ring-brand-primary/25" : "",
                      )}
                    >
                      <div className="flex min-h-0 min-w-0 flex-1 flex-col justify-between gap-1.5">
                        <p className="truncate text-sm font-bold text-slate-800">
                          {patientName}
                          <span className="font-medium text-slate-500">
                            {" "}
                            · {patientAge} anni
                          </span>
                        </p>
                        <p className="h-10 overflow-hidden text-xs leading-5 text-slate-600 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">
                          {condition}
                        </p>
                        <span
                          className={cn(
                            "text-[11px] font-semibold",
                            DIFFICULTY_TONE[difficultyKey],
                          )}
                        >
                          {difficultyLabel}
                        </span>
                      </div>
                      <span
                        className="flex shrink-0 items-center self-center text-slate-400 transition group-hover:text-brand-primary"
                        aria-hidden
                      >
                        <ChevronRight className="h-4 w-4" />
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ) : buckets.length === 0 ? (
          <div className="flex min-h-[240px] flex-col items-center justify-center px-4 py-12 text-center">
            <FolderOpen className="h-8 w-8 text-slate-300" aria-hidden />
            <p className="mt-3 text-sm font-semibold text-slate-600">Nessuna cartella</p>
            <p className="mt-1 max-w-sm text-xs leading-relaxed text-slate-400">
              Non ci sono ancora casi clinici disponibili.
            </p>
          </div>
        ) : (
          <div className="space-y-3.5">
            <div className="flex flex-wrap items-center gap-2">
              <FolderOpen className="h-4 w-4 text-brand-secondary" aria-hidden />
              <p className="font-display text-sm font-semibold text-brand-primary">
                Cartelle principali
              </p>
              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                {buckets.length} specialità · {safeCases.length} casi
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {buckets.map((bucket) => (
                <div key={bucket.name} className="relative pt-2.5">
                  <FolderNotch fill={bucket.pastel.fill} />
                  <button
                    type="button"
                    onClick={() =>
                      setParams({ specialty: bucket.name, caseId: null })
                    }
                    style={{
                      backgroundColor: bucket.pastel.fill,
                      borderColor: bucket.pastel.border,
                    }}
                    className={cn(
                      "group relative flex h-[8.25rem] w-full min-w-0 flex-col justify-between overflow-hidden rounded-b-xl rounded-tr-xl border px-3.5 py-3.5 text-left transition duration-200",
                      "hover:-translate-y-0.5 hover:brightness-[0.97] hover:shadow-aequan-panel",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/30",
                    )}
                  >
                    <div className="min-w-0 space-y-1">
                      <p
                        className="text-[11px] font-semibold uppercase tracking-[0.12em]"
                        style={{ color: bucket.pastel.accent }}
                      >
                        Specialità
                      </p>
                      <p className="font-display text-[1.05rem] font-bold leading-snug tracking-tight text-slate-800">
                        {bucket.name}
                      </p>
                      <p className="text-[11px] leading-snug text-slate-500">
                        {difficultyMix(bucket.cases)}
                      </p>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium text-slate-600">
                        {bucket.cases.length === 1
                          ? "1 caso clinico"
                          : `${bucket.cases.length} casi clinici`}
                      </p>
                      <span
                        className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/55 text-slate-500 transition group-hover:text-brand-primary"
                        aria-hidden
                      >
                        <ChevronRight className="h-4 w-4" />
                      </span>
                    </div>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {selectedCase ? (
        <PrassiCaseBriefing
          caseRow={selectedCase}
          open
          onClose={() => setParams({ caseId: null })}
          pastel={
            activeBucket?.pastel ??
            buckets.find(
              (b) =>
                b.name.toLowerCase() ===
                displaySpecialtyName(selectedCase).toLowerCase(),
            )?.pastel
          }
        />
      ) : null}
    </div>
  );
}
