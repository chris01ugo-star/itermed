import type { ReactNode } from "react";
import { Suspense } from "react";
import { config } from "@/lib/config";
import { requireUser } from "@/lib/require-user";
import {
  fetchFilteredClinicalCases,
  fetchMedicalSpecialtyOptionsCached,
  type CaseFilterParams,
} from "@/lib/dashboard-queries";
import { PrassiShell } from "@/components/prassi/PrassiShell";
import type { ClinicalCaseRow } from "@/components/dashboard/ClinicalCaseCard";

type PrassiLayoutProps = {
  children: ReactNode;
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

const DEMO_SPECIALTIES = [
  { id: "sp_emergenza", name: "Emergenza" },
  { id: "sp_interna", name: "Medicina interna" },
  { id: "sp_neuro", name: "Neurologia" },
];

async function loadCasesAndSpecialties(): Promise<{
  cases: ClinicalCaseRow[];
  specialties: { id: string; name: string }[];
}> {
  const user = await requireUser();
  const hasDatabase = Boolean(config.DATABASE_URL) && !config.DATABASE_URL.includes("itermed_dev");

  if (!hasDatabase) {
    return { cases: DEMO_CASES(user.id), specialties: DEMO_SPECIALTIES };
  }

  try {
    const filters: CaseFilterParams = {};
    const [rows, specialtyRows] = await Promise.all([
      fetchFilteredClinicalCases(user.id, filters, 60),
      fetchMedicalSpecialtyOptionsCached(),
    ]);
    return {
      cases: rows as ClinicalCaseRow[],
      specialties: specialtyRows,
    };
  } catch {
    return { cases: DEMO_CASES(user.id), specialties: DEMO_SPECIALTIES };
  }
}

export default async function PrassiLayout({ children }: PrassiLayoutProps) {
  const { cases, specialties } = await loadCasesAndSpecialties();

  return (
    <Suspense
      fallback={
        <div className="rounded-xl border border-slate-100 bg-white p-8 text-sm text-slate-500 shadow-sm">
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
