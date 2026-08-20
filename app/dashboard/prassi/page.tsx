import { Suspense } from "react";
import { config, isUsableDatabase } from "@/lib/config";
import { requireUser } from "@/lib/require-user";
import {
  fetchFilteredClinicalCases,
  fetchMedicalSpecialtyOptionsCached,
  parseCaseDifficulty,
  type CaseFilterParams,
} from "@/lib/dashboard-queries";
import { fetchUserOverviewData } from "@/lib/overview-queries";
import { PrassiWelcomeDashboard } from "@/components/prassi/PrassiEmptyState";
import { PrassiCaseBriefing } from "@/components/prassi/PrassiCaseBriefing";
import { PrassiShell } from "@/components/prassi/PrassiShell";
import type { ClinicalCaseRow } from "@/components/dashboard/ClinicalCaseCard";
import {
  getPrassiRegistryCaseRows,
  getPrassiRegistrySpecialties,
} from "@/lib/data/cases";

type PrassiPageProps = {
  searchParams?:
    | Promise<{ specialtyId?: string; specialty?: string; difficulty?: string; caseId?: string }>
    | { specialtyId?: string; specialty?: string; difficulty?: string; caseId?: string };
};

function filterDemoCases(cases: ClinicalCaseRow[], filters: CaseFilterParams): ClinicalCaseRow[] {
  return cases.filter((c) => {
    if (filters.difficulty && c.difficulty !== filters.difficulty) return false;
    if (filters.specialtyId || filters.specialtyName) {
      const specialtyName = c.medicalSpecialty?.name ?? c.specialty ?? "";
      const target = filters.specialtyName ?? filters.specialtyId ?? "";
      if (specialtyName.toLowerCase() !== target.toLowerCase()) return false;
    }
    return true;
  });
}

function mergeRegistryIntoDbCases(
  dbCases: ClinicalCaseRow[],
  userId: string,
): ClinicalCaseRow[] {
  const registry = getPrassiRegistryCaseRows(userId);
  const byId = new Map<string, ClinicalCaseRow>();
  for (const row of dbCases) byId.set(row.id, row);
  for (const row of registry) {
    if (!byId.has(row.id)) byId.set(row.id, row);
  }
  return Array.from(byId.values());
}

function mergeRegistrySpecialties(
  dbSpecialties: { id: string; name: string }[],
): { id: string; name: string }[] {
  const byId = new Map<string, { id: string; name: string }>();
  for (const s of [...getPrassiRegistrySpecialties(), ...dbSpecialties]) {
    byId.set(s.id, s);
  }
  return Array.from(byId.values());
}

export default async function PrassiPage({ searchParams }: PrassiPageProps) {
  const user = await requireUser();
  const hasDatabase = isUsableDatabase(config.DATABASE_URL);
  const resolvedSearch =
    searchParams && "then" in searchParams ? await searchParams : searchParams;

  const filters: CaseFilterParams = {
    specialtyId: resolvedSearch?.specialtyId,
    specialtyName: resolvedSearch?.specialty,
    difficulty: parseCaseDifficulty(resolvedSearch?.difficulty),
  };

  let cases: ClinicalCaseRow[] = getPrassiRegistryCaseRows(user.id);
  let specialties = getPrassiRegistrySpecialties();
  let welcomeStats = {
    casesThisWeek: 0,
    averageScore: null as number | null,
    focusShort: "Appropriatezza prescrittiva",
  };

  if (hasDatabase) {
    try {
      const [caseRows, specialtyRows, overview] = await Promise.all([
        fetchFilteredClinicalCases(user.id, filters, 60),
        fetchMedicalSpecialtyOptionsCached().catch(() => [] as { id: string; name: string }[]),
        fetchUserOverviewData(user.id).catch(() => null),
      ]);
      cases = mergeRegistryIntoDbCases(caseRows as ClinicalCaseRow[], user.id);
      specialties = mergeRegistrySpecialties(specialtyRows);
      if (overview) {
        welcomeStats = {
          casesThisWeek: overview.casesThisWeek,
          averageScore: overview.iterMedScore,
          focusShort: overview.focusShort || overview.focusLabel || welcomeStats.focusShort,
        };
      }
    } catch {
      cases = filterDemoCases(getPrassiRegistryCaseRows(user.id), filters);
    }
  } else {
    cases = filterDemoCases(getPrassiRegistryCaseRows(user.id), filters);
    welcomeStats = {
      casesThisWeek: 8,
      averageScore: 31,
      focusShort: "Appropriatezza prescrittiva",
    };
  }

  const selectedId = resolvedSearch?.caseId?.trim() || null;
  const selected = selectedId ? cases.find((c) => c.id === selectedId) ?? null : null;

  return (
    <Suspense
      fallback={
        <div className="rounded-xl border border-slate-100 bg-white p-8 text-sm text-slate-500 shadow-sm">
          Caricamento Prassi Clinica…
        </div>
      }
    >
      <PrassiShell cases={cases} specialties={specialties}>
        {selected ? (
          <PrassiCaseBriefing caseRow={selected} />
        ) : (
          <PrassiWelcomeDashboard stats={welcomeStats} />
        )}
      </PrassiShell>
    </Suspense>
  );
}
