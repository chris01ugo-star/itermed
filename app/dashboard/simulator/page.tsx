import { Suspense } from "react";
import { config } from "../../../lib/config";
import { requireUser } from "../../../lib/require-user";
import {
  fetchFilteredClinicalCases,
  fetchMedicalSpecialtyOptions,
  parseCaseDifficulty,
  type CaseFilterParams,
} from "../../../lib/dashboard-queries";
import { CaseFilters } from "../../../components/dashboard/CaseFilters";
import { ClinicalCaseGrid } from "../../../components/dashboard/ClinicalCaseGrid";
import { type ClinicalCaseRow } from "../../../components/dashboard/ClinicalCaseCard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../ui/card";

type DashboardSimulatorPageProps = {
  searchParams?:
    | Promise<{ specialtyId?: string; specialty?: string; difficulty?: string }>
    | { specialtyId?: string; specialty?: string; difficulty?: string };
};

const DEMO_CASES = (userId: string): ClinicalCaseRow[] => [
  {
    id: "cs_001",
    title: "Uomo 58 anni con dolore toracico in PS",
    specialty: "Medicina d'Emergenza-Urgenza",
    difficulty: "MEDIUM",
    createdById: "seed",
    isGlobal: true,
  },
  {
    id: "cs_002",
    title: "Donna 72 anni con febbre persistente",
    specialty: "Medicina Interna",
    difficulty: "EASY",
    createdById: userId,
    isGlobal: false,
  },
  {
    id: "cs_003",
    title: "Uomo 33 anni con idrocefalo e cefalea acuta",
    specialty: "Neurologia",
    difficulty: "HARD",
    createdById: "seed",
    isGlobal: true,
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

export default async function DashboardSimulatorPage({ searchParams }: DashboardSimulatorPageProps) {
  const user = await requireUser();
  const hasDatabase = Boolean(config.DATABASE_URL);
  const resolvedSearch =
    searchParams && "then" in searchParams ? await searchParams : searchParams;

  const filters: CaseFilterParams = {
    specialtyId: resolvedSearch?.specialtyId,
    specialtyName: resolvedSearch?.specialty,
    difficulty: parseCaseDifficulty(resolvedSearch?.difficulty),
  };

  let cases: ClinicalCaseRow[] | null = null;
  let specialties: { id: string; name: string }[] = [];

  if (hasDatabase) {
    try {
      const [caseRows, specialtyRows] = await Promise.all([
        fetchFilteredClinicalCases(user.id, filters, 30),
        fetchMedicalSpecialtyOptions(),
      ]);
      cases = caseRows as ClinicalCaseRow[];
      specialties = specialtyRows;
    } catch {
      cases = null;
    }
  }

  const source = cases ?? filterDemoCases(DEMO_CASES(user.id), filters);
  const globalCases = source.filter((c) => c.isGlobal);
  const personalCases = source.filter((c) => !c.isGlobal && c.createdById === user.id);

  return (
    <div className="flex flex-col gap-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">Simulatore</h1>
        <p className="text-sm text-zinc-400">
          Avvia rapidamente una simulazione scegliendo un caso
          {hasDatabase ? " dal database." : " (modalità demo senza database configurato)."}
        </p>
      </header>

      {hasDatabase && specialties.length > 0 ? (
        <Suspense fallback={<p className="text-xs text-zinc-500">Caricamento filtri…</p>}>
          <CaseFilters specialties={specialties} resultCount={source.length} />
        </Suspense>
      ) : null}

      <Card className="bg-white/80 border-zinc-200/80">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-zinc-950">Scegli un caso</CardTitle>
          <CardDescription>
            {source.length} {source.length === 1 ? "caso" : "casi"} disponibili con i filtri attivi.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm space-y-8">
          <section>
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-3">
              Globali (tutti)
            </p>
            <ClinicalCaseGrid
              cases={globalCases}
              mode="link"
              emptyMessage="Nessun caso globale con questi filtri."
            />
          </section>
          <section>
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-3">
              I tuoi casi individuali
            </p>
            <ClinicalCaseGrid
              cases={personalCases}
              mode="link"
              emptyMessage="Nessun caso individuale con questi filtri."
            />
          </section>
        </CardContent>
      </Card>
    </div>
  );
}
