import { config, isUsableDatabase } from "@/lib/config";
import { requireUser } from "@/lib/require-user";
import {
  fetchFilteredClinicalCases,
  parseCaseDifficulty,
  type CaseFilterParams,
} from "@/lib/dashboard-queries";
import { fetchUserOverviewData } from "@/lib/overview-queries";
import { PrassiWelcomeDashboard } from "@/components/prassi/PrassiEmptyState";
import { PrassiCaseBriefing } from "@/components/prassi/PrassiCaseBriefing";
import type { ClinicalCaseRow } from "@/components/dashboard/ClinicalCaseCard";
import { getPrassiRegistryCaseRows } from "@/lib/data/cases";

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

  let cases: ClinicalCaseRow[] = [];
  let welcomeStats = {
    casesThisWeek: 0,
    averageScore: null as number | null,
    focusShort: "Appropriatezza prescrittiva",
  };

  if (hasDatabase) {
    try {
      const [caseRows, overview] = await Promise.all([
        fetchFilteredClinicalCases(user.id, filters, 60),
        fetchUserOverviewData(user.id).catch(() => null),
      ]);
      const registryFiltered = filterDemoCases(getPrassiRegistryCaseRows(user.id), filters);
      const byId = new Map<string, ClinicalCaseRow>();
      for (const row of caseRows as ClinicalCaseRow[]) byId.set(row.id, row);
      for (const row of registryFiltered) {
        if (!byId.has(row.id)) byId.set(row.id, row);
      }
      cases = Array.from(byId.values());
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

  return selected ? (
    <PrassiCaseBriefing caseRow={selected} />
  ) : (
    <PrassiWelcomeDashboard stats={welcomeStats} />
  );
}
