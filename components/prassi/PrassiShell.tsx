"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { type ReactNode } from "react";
import { ChevronRight, FolderOpen } from "lucide-react";
import {
  DIFFICULTY_LABELS,
  displaySpecialtyName,
  isCaseDifficulty,
  type CaseDifficulty,
} from "@/lib/dashboard-case-utils";
import { cn } from "@/app/utils/cn";
import type { ClinicalCaseRow } from "@/components/dashboard/ClinicalCaseCard";
import { CaseFilters } from "@/components/dashboard/CaseFilters";
import { estimateAgeFromTitle, patientDisplayName } from "@/lib/prassi/demo-vitals";
import { PRASSI_PASTELS } from "@/lib/ui/prassi-pastels";

type SpecialtyOption = {
  id: string;
  name: string;
};

type PrassiShellProps = {
  cases: ClinicalCaseRow[];
  specialties?: SpecialtyOption[];
  children: ReactNode;
};

/** Strips the "Uomo/Donna NN anni (con)" prefix so the condition reads as a short clinical note. */
function conditionFromTitle(title?: string | null): string {
  const raw = (title ?? "").trim();
  if (!raw) return "Caso clinico";
  const stripped = raw.replace(/^(uomo|donna)\s+\d{1,3}\s*anni?\s*(con\s+)?/i, "").trim();
  if (!stripped) return raw;
  return stripped.charAt(0).toUpperCase() + stripped.slice(1);
}

function specialtyStyle(label: string) {
  let hash = 0;
  for (let i = 0; i < label.length; i += 1) {
    hash = (hash * 31 + label.charCodeAt(i)) >>> 0;
  }
  return PRASSI_PASTELS[hash % PRASSI_PASTELS.length];
}

const DIFFICULTY_TONE: Record<CaseDifficulty, string> = {
  EASY: "text-emerald-700",
  MEDIUM: "text-amber-800",
  HARD: "text-rose-700",
};

export function PrassiShell({ cases, specialties = [], children }: PrassiShellProps) {
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const queryCaseId = searchParams?.get("caseId") ?? null;
  const specialtyId = searchParams?.get("specialtyId") ?? null;
  const specialtyName = searchParams?.get("specialty") ?? null;
  const difficulty = searchParams?.get("difficulty") ?? null;
  const searchQuery = (searchParams?.get("q") ?? "").trim().toLowerCase();
  const playMatch = pathname.match(/\/dashboard\/prassi\/play\/([^/]+)/);
  const isPlaying = Boolean(playMatch);
  const activeCaseId = playMatch?.[1] ?? queryCaseId ?? null;
  const safeCases = Array.isArray(cases) ? cases.filter(Boolean) : [];
  const safeSpecialties = Array.isArray(specialties)
    ? specialties.filter((s) => s?.id && s?.name)
    : [];

  const specialtyNameById = new Map(safeSpecialties.map((s) => [s.id, s.name.toLowerCase()]));

  const visibleCases = safeCases.filter((c) => {
    if (!c?.id) return false;
    if (difficulty && c.difficulty !== difficulty) return false;
    if (specialtyName || specialtyId) {
      const label = (c.medicalSpecialty?.name ?? c.specialty ?? "").toLowerCase();
      if (specialtyName && label !== specialtyName.toLowerCase()) return false;
      if (specialtyId) {
        const targetName = specialtyNameById.get(specialtyId);
        if (targetName && label !== targetName) return false;
        if (!targetName) return false;
      }
    }
    if (searchQuery) {
      const haystack = [
        c.title,
        c.specialty,
        c.medicalSpecialty?.name,
        displaySpecialtyName(c),
        patientDisplayName(c.id, c.title, c.sex),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(searchQuery)) return false;
    }
    return true;
  });

  const filterQuery = [
    specialtyId ? `specialtyId=${encodeURIComponent(specialtyId)}` : "",
    specialtyName ? `specialty=${encodeURIComponent(specialtyName)}` : "",
    difficulty ? `difficulty=${encodeURIComponent(difficulty)}` : "",
    searchQuery ? `q=${encodeURIComponent(searchQuery)}` : "",
  ]
    .filter(Boolean)
    .join("&");

  const renderCaseList = (list: ClinicalCaseRow[]) => (
    <div className="scrollbar-aequan min-h-0 flex-1 space-y-3.5 overflow-y-auto overflow-x-hidden px-3 pb-5 pt-4">
      {list.length === 0 ? (
        <div className="mx-1 rounded-xl border border-dashed border-border bg-ui-bg/60 px-3 py-8 text-center">
          <FolderOpen className="mx-auto h-5 w-5 text-slate-400" aria-hidden />
          <p className="mt-2 text-sm font-medium text-slate-600">Nessuna cartella</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">
            Prova a togliere un filtro o a cambiare la ricerca.
          </p>
        </div>
      ) : (
        list.map((caseRow) => {
          const isActive = activeCaseId === caseRow.id;
          const specialty = displaySpecialtyName(caseRow);
          const difficultyKey = isCaseDifficulty(caseRow.difficulty)
            ? caseRow.difficulty
            : "MEDIUM";
          const difficultyLabel =
            DIFFICULTY_LABELS[difficultyKey] ?? String(caseRow.difficulty ?? "Media");
          const patientName = patientDisplayName(caseRow.id, caseRow.title, caseRow.sex);
          const patientAge = caseRow.age ?? estimateAgeFromTitle(caseRow.title);
          const href = isPlaying
            ? `/dashboard/prassi/play/${encodeURIComponent(caseRow.id)}`
            : `/dashboard/prassi?caseId=${encodeURIComponent(caseRow.id)}${
                filterQuery ? `&${filterQuery}` : ""
              }`;
          const inProgress = isActive && isPlaying;
          const condition = conditionFromTitle(caseRow.title);
          const dept = specialtyStyle(specialty);
          return (
            <div key={caseRow.id} className="relative">
              {/* Folder notch — keep the silhouette users like */}
              <span
                className="absolute left-3 top-0 z-10 h-2.5 w-11 -translate-y-[calc(100%-1px)] rounded-t-md"
                style={{ backgroundColor: dept.fill }}
                aria-hidden
              />
              <Link
                href={href}
                aria-current={isActive ? "page" : undefined}
                style={{
                  backgroundColor: dept.fill,
                  borderColor: isActive ? "#1E324E" : dept.border,
                }}
                className={cn(
                  "group relative flex min-w-0 items-stretch gap-2 overflow-hidden rounded-b-xl rounded-tr-xl border px-3.5 py-3 transition duration-200",
                  "hover:brightness-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/30",
                  isActive ? "shadow-aequan-panel ring-1 ring-brand-primary/25" : "",
                )}
              >
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate text-sm font-bold text-slate-800">
                      {patientName}
                      <span className="font-medium text-slate-500"> · {patientAge} anni</span>
                    </p>
                    {inProgress ? (
                      <span className="shrink-0 text-[9px] font-bold uppercase tracking-wide text-brand-primary">
                        In corso
                      </span>
                    ) : null}
                  </div>
                  <p className="line-clamp-2 text-xs leading-snug text-slate-600">{condition}</p>
                  <div className="flex items-center justify-between gap-2 pt-0.5">
                    <span className="min-w-0 truncate text-[11px] text-slate-500">{specialty}</span>
                    <span
                      className={cn(
                        "shrink-0 text-[11px] font-semibold",
                        DIFFICULTY_TONE[difficultyKey],
                      )}
                    >
                      {difficultyLabel}
                    </span>
                  </div>
                </div>
                <span
                  className={cn(
                    "flex shrink-0 items-center self-center text-slate-400 transition group-hover:text-brand-primary",
                    isActive && "text-brand-primary",
                  )}
                  aria-hidden
                >
                  <ChevronRight className="h-4 w-4" />
                </span>
              </Link>
            </div>
          );
        })
      )}
    </div>
  );

  /* Immersive simulation: full-viewport workspace, no page scroll chrome. */
  if (isPlaying) {
    return (
      <div className="flex h-[100dvh] max-h-[100dvh] min-h-0 w-full overflow-hidden bg-[#F4F6F8]">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-2.5 sm:p-3">
          {children}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-4 bg-[#F4F6F8] px-4 pb-4 pt-3 md:px-6 md:pb-6 md:pt-4">
      <header className="shrink-0 space-y-1">
        <h1 className="font-display text-[1.55rem] font-bold tracking-tight text-text-primary md:text-[1.7rem]">
          Prassi Clinica
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-slate-500">
          Apri una cartella paziente, leggi il brief e avvia la simulazione.
        </p>
      </header>

      <CaseFilters
        specialties={safeSpecialties}
        resultCount={visibleCases.length}
        variant="prassi"
      />

      <div className="grid min-h-0 flex-1 grid-cols-12 gap-4">
        <aside className="col-span-12 flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-panel-bg shadow-aequan-panel md:col-span-4 lg:col-span-3">
          <div className="shrink-0 border-b border-border-subtle px-4 py-3.5">
            <div className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-brand-secondary" aria-hidden />
              <p className="font-display text-sm font-semibold text-brand-primary">
                Cartelle pazienti
              </p>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {visibleCases.length === 0
                ? "Nessun caso con i filtri attivi"
                : visibleCases.length === 1
                  ? "1 cartella — tocca per aprire il brief"
                  : `${visibleCases.length} cartelle — tocca per aprire il brief`}
            </p>
          </div>
          {renderCaseList(visibleCases)}
        </aside>

        <section className="scrollbar-aequan col-span-12 h-full min-h-0 min-w-0 overflow-y-auto rounded-xl border border-border bg-panel-bg p-5 shadow-aequan-panel md:col-span-8 md:p-6 lg:col-span-9">
          {children}
        </section>
      </div>
    </div>
  );
}
