import { Suspense } from "react";
import { config, isUsableDatabase } from "@/lib/config";
import { requireUser } from "@/lib/require-user";
import {
  fetchFilteredClinicalCases,
  fetchMedicalSpecialtyOptionsCached,
} from "@/lib/dashboard-queries";
import { PrassiShell } from "@/components/prassi/PrassiShell";
import type { ClinicalCaseRow } from "@/components/dashboard/ClinicalCaseCard";
import {
  getPrassiRegistryCaseRows,
  getPrassiRegistrySpecialties,
} from "@/lib/data/cases";

async function mergeRegistryIntoDbCases(
  dbCases: ClinicalCaseRow[],
  userId: string,
): Promise<ClinicalCaseRow[]> {
  const registry = await getPrassiRegistryCaseRows(userId);
  const byId = new Map<string, ClinicalCaseRow>();
  for (const row of dbCases) byId.set(row.id, row);
  for (const row of registry) {
    if (!byId.has(row.id)) byId.set(row.id, row);
  }
  return Array.from(byId.values());
}

async function mergeRegistrySpecialties(
  dbSpecialties: { id: string; name: string }[],
): Promise<{ id: string; name: string }[]> {
  const byId = new Map<string, { id: string; name: string }>();
  for (const s of [...(await getPrassiRegistrySpecialties()), ...dbSpecialties]) {
    byId.set(s.id, s);
  }
  return Array.from(byId.values());
}

export default async function PrassiPage() {
  const user = await requireUser();
  const hasDatabase = isUsableDatabase(config.DATABASE_URL);

  let cases: ClinicalCaseRow[] = await getPrassiRegistryCaseRows(user.id);
  let specialties = await getPrassiRegistrySpecialties();

  if (hasDatabase) {
    try {
      const [caseRows, specialtyRows] = await Promise.all([
        fetchFilteredClinicalCases(user.id, {}, 200),
        fetchMedicalSpecialtyOptionsCached().catch(() => [] as { id: string; name: string }[]),
      ]);
      cases = await mergeRegistryIntoDbCases(caseRows as ClinicalCaseRow[], user.id);
      specialties = await mergeRegistrySpecialties(specialtyRows);
    } catch {
      cases = await getPrassiRegistryCaseRows(user.id);
    }
  }

  return (
    <Suspense
      fallback={
        <div className="rounded-xl border border-slate-100 bg-white p-8 text-sm text-slate-500 shadow-sm">
          Caricamento Prassi Clinica…
        </div>
      }
    >
      <PrassiShell cases={cases} specialties={specialties} />
    </Suspense>
  );
}
