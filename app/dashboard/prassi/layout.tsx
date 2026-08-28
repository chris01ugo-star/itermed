import type { ReactNode } from "react";

type PrassiLayoutProps = {
  children: ReactNode;
};

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

async function loadCasesAndSpecialties(): Promise<{
  cases: ClinicalCaseRow[];
  specialties: { id: string; name: string }[];
}> {
  const user = await requireUser();
  const hasDatabase = isUsableDatabase(config.DATABASE_URL);

  if (!hasDatabase) {
    return {
      cases: getPrassiRegistryCaseRows(user.id),
      specialties: getPrassiRegistrySpecialties(),
    };
  }

  try {
    const filters: CaseFilterParams = {};
    const [rows, specialtyRows] = await Promise.all([
      fetchFilteredClinicalCases(user.id, filters, 60),
      fetchMedicalSpecialtyOptionsCached(),
    ]);
    return {
      cases: mergeRegistryIntoDbCases(rows as ClinicalCaseRow[], user.id),
      specialties: mergeRegistrySpecialties(specialtyRows),
    };
  } catch {
    return {
      cases: getPrassiRegistryCaseRows(user.id),
      specialties: getPrassiRegistrySpecialties(),
    };
  }
}

export default async function PrassiLayout({ children }: PrassiLayoutProps) {
  const { cases, specialties } = await loadCasesAndSpecialties();

  return (
    <Suspense
      fallback={
        <div className="rounded-xl border border-border bg-panel-bg p-8 text-sm text-slate-500 shadow-aequan-panel">
          Caricamento Prassi Clinica…
        </div>
      }
    >
      <PrassiShell cases={cases} specialties={specialties}>
        {children}
      </PrassiShell>
    </Suspense>
  );
}
