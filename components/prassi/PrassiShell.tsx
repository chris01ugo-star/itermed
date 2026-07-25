"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { type ReactNode } from "react";
import {
  DIFFICULTY_LABELS,
  displaySpecialtyName,
  isCaseDifficulty,
} from "@/lib/dashboard-case-utils";
import { cn } from "@/app/utils/cn";
import type { ClinicalCaseRow } from "@/components/dashboard/ClinicalCaseCard";
import { CaseFilters } from "@/components/dashboard/CaseFilters";
import { estimateAgeFromTitle, patientDisplayName } from "@/lib/prassi/demo-vitals";

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

/**
 * Very light, sober pastel fill for the whole folder-shaped card — one per
 * department family. Deliberately custom hex (not named Tailwind colours) so
 * it never inherits the app's global colour remaps. Same specialty name →
 * always the same pastel.
 */
const SPECIALTY_PALETTE: Array<{ fill: string; border: string }> = [
  { fill: "#EEF2F9", border: "#DCE4F0" }, // pale blue
  { fill: "#EAF6F1", border: "#D7EDE3" }, // pale mint
  { fill: "#FDF3E5", border: "#F8E4C4" }, // pale peach
  { fill: "#FBEDEF", border: "#F3D9DE" }, // pale blush
  { fill: "#F0ECFB", border: "#E1D8F5" }, // pale lavender
  { fill: "#E9F4F7", border: "#D5E9EF" }, // pale sky
  { fill: "#F2F0ED", border: "#E5E1DA" }, // pale sand
];

function specialtyStyle(label: string) {
  let hash = 0;
  for (let i = 0; i < label.length; i += 1) {
    hash = (hash * 31 + label.charCodeAt(i)) >>> 0;
  }
  return SPECIALTY_PALETTE[hash % SPECIALTY_PALETTE.length];
}

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
    <div className="scrollbar-aequan min-h-0 flex-1 space-y-4 overflow-y-auto overflow-x-hidden p-3 pt-4 pb-6">
      {list.length === 0 ? (
        <p className="px-2 py-8 text-center text-sm text-slate-400">
          Nessun caso disponibile con i filtri attivi.
        </p>
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
          const patientAge = estimateAgeFromTitle(caseRow.title);
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
              {/* Folder notch: same pastel fill as the body, fused flush on top — real folder silhouette. */}
              <span
                className="absolute left-3 top-0 z-10 h-2.5 w-10 -translate-y-[calc(100%-1px)] rounded-t-md"
                style={{ backgroundColor: dept.fill }}
                aria-hidden
              />
              <Link
                href={href}
                style={{ backgroundColor: dept.fill, borderColor: isActive ? "#1E324E" : dept.border }}
                className={cn(
                  "relative flex min-w-0 flex-col gap-2 overflow-hidden rounded-b-xl rounded-tr-xl border px-3.5 py-3 transition-all duration-200 hover:brightness-[0.98]",
                  isActive ? "shadow-sm ring-1 ring-[#1E324E]/20" : "",
                )}
              >
                {inProgress ? (
                  <span className="absolute right-3 top-3 text-[9px] font-bold uppercase tracking-wide text-[#1E324E]">
                    In corso
                  </span>
                ) : null}

                <p className="truncate pr-14 text-sm font-bold text-slate-800">
                  {patientName}
                  <span className="font-medium text-slate-500"> · {patientAge} anni</span>
                </p>
                <p className="line-clamp-1 text-xs leading-snug text-slate-600">{condition}</p>

                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-xs text-slate-600">{specialty}</span>
                  <span className="shrink-0 text-xs font-medium text-slate-700">
                    {difficultyLabel}
                  </span>
                </div>
              </Link>
            </div>
          );
        })
      )}
    </div>
  );

  /* Immersive simulation: full-width workspace, no case rail — keeps focus on the active case. */
  if (isPlaying) {
    return (
      <div className="flex h-screen min-h-0 w-full overflow-hidden bg-[#F4F6F8]">
        <div className="scrollbar-aequan min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4">
          {children}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-3 px-4 pb-4 pt-2.5 md:px-6 md:pb-6 md:pt-3">
      {safeSpecialties.length > 0 ? (
        <CaseFilters specialties={safeSpecialties} resultCount={visibleCases.length} />
      ) : (
        <div className="flex h-14 shrink-0 items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-2 shadow-sm">
          <p className="text-sm text-slate-500">Filtri non disponibili</p>
          <span className="text-xs tabular-nums text-slate-500">
            {visibleCases.length} {visibleCases.length === 1 ? "risultato" : "risultati"}
          </span>
        </div>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-12 gap-4">
        <aside className="col-span-12 flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:col-span-4 lg:col-span-3">
          <div className="shrink-0 border-b border-slate-100 px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
              I miei casi
            </p>
            <p className="mt-0.5 text-xs text-slate-400">
              {visibleCases.length}{" "}
              {visibleCases.length === 1 ? "caso disponibile" : "casi disponibili"}
            </p>
          </div>
          {renderCaseList(visibleCases)}
        </aside>

        <section className="scrollbar-aequan col-span-12 h-full min-h-0 min-w-0 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:col-span-8 lg:col-span-9">
          {children}
        </section>
      </div>
    </div>
  );
}
