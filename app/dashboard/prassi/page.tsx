import { config } from "@/lib/config";
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

type PrassiPageProps = {
  searchParams?:
    | Promise<{ specialtyId?: string; specialty?: string; difficulty?: string; caseId?: string }>
    | { specialtyId?: string; specialty?: string; difficulty?: string; caseId?: string };
};

const DEMO_CASES = (userId: string): ClinicalCaseRow[] => [
  {
    id: "cs_001",
    title: "Uomo 58 anni con dolore toracico in PS",
    specialty: "Medicina d'Emergenza-Urgenza",
    difficulty: "MEDIUM",
    createdById: "seed",
    isGlobal: true,
    sex: "M",
  },
  {
    id: "cs_002",
    title: "Donna 72 anni con febbre persistente",
    specialty: "Medicina Interna",
    difficulty: "EASY",
    createdById: userId,
    isGlobal: false,
    sex: "F",
  },
  {
    id: "cs_003",
    title: "Uomo 33 anni con idrocefalo e cefalea acuta",
    specialty: "Neurologia",
    difficulty: "HARD",
    createdById: "seed",
    isGlobal: true,
    sex: "M",
  },
];

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
  const hasDatabase = Boolean(config.DATABASE_URL) && !config.DATABASE_URL.includes("itermed_dev");
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
      cases = caseRows as ClinicalCaseRow[];
      if (overview) {
        welcomeStats = {
          casesThisWeek: overview.casesThisWeek,
          averageScore: overview.iterMedScore,
          focusShort: overview.focusShort || overview.focusLabel || welcomeStats.focusShort,
        };
      }
    } catch {
      cases = filterDemoCases(DEMO_CASES(user.id), filters);
    }
  } else {
    cases = filterDemoCases(DEMO_CASES(user.id), filters);
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
