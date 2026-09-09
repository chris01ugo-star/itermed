import type { Prisma } from "@prisma/client";
import { unstable_cache } from "next/cache";
import { visibleCasesWhere } from "@/lib/access-queries";
import { prisma } from "@/lib/prisma";
import {
  type CaseDifficulty,
  type CaseFilterParams,
  DIFFICULTY_LABELS,
  displaySpecialtyName,
  parseCaseDifficulty,
} from "@/lib/dashboard-case-utils";

export type { CaseDifficulty, CaseFilterParams };
export { DIFFICULTY_LABELS, displaySpecialtyName, parseCaseDifficulty };

const DB_LOOKUP_TIMEOUT_MS = 4_000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`[dashboard-queries] ${label} timed out after ${ms}ms`)),
      ms,
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

export function filteredCasesWhere(
  userId: string,
  filters?: CaseFilterParams,
): Prisma.ClinicalCaseWhereInput {
  const specialtyNameFilter = filters?.specialtyName?.trim();

  return {
    ...visibleCasesWhere(userId),
    ...(filters?.specialtyId ? { medicalSpecialtyId: filters.specialtyId } : {}),
    ...(specialtyNameFilter
      ? {
          OR: [
            {
              medicalSpecialty: {
                name: { equals: specialtyNameFilter, mode: "insensitive" },
              },
            },
            { specialty: { equals: specialtyNameFilter, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(filters?.difficulty ? { difficulty: filters.difficulty } : {}),
  };
}

/** Loads visible clinical cases with MedicalSpecialty relation for dashboard views. */
export async function fetchFilteredClinicalCases(
  userId: string,
  filters?: CaseFilterParams,
  take = 50,
) {
  const rows = await withTimeout(
    prisma.clinicalCase.findMany({
      where: filteredCasesWhere(userId, filters),
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        difficulty: true,
        specialty: true,
        isGlobal: true,
        createdById: true,
        baselineExamFindings: true,
        medicalSpecialty: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      take,
    }),
    DB_LOOKUP_TIMEOUT_MS,
    "clinicalCase.findMany",
  );

  return rows.map((row) => {
    const baseline = row.baselineExamFindings as
      | { demographics?: { sex?: string | null; age?: number | string | null } }
      | null
      | undefined;
    const sex = baseline?.demographics?.sex ?? null;
    const ageNum = Number(baseline?.demographics?.age);
    const age =
      Number.isFinite(ageNum) && ageNum >= 1 && ageNum <= 120 ? Math.round(ageNum) : null;
    const { baselineExamFindings: _omit, ...rest } = row;
    return { ...rest, sex, age };
  });
}

/** All medical specialties for dynamic filter badges. */
export async function fetchMedicalSpecialtyOptions() {
  return withTimeout(
    prisma.medicalSpecialty.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    DB_LOOKUP_TIMEOUT_MS,
    "medicalSpecialty.findMany",
  );
}

/**
 * Shared specialty list — cached across requests (not user-specific).
 * Revalidates every 5 minutes to keep Prassi filters snappy under load.
 */
export const fetchMedicalSpecialtyOptionsCached = unstable_cache(
  async () => fetchMedicalSpecialtyOptions(),
  ["medical-specialty-options-v1"],
  { revalidate: 300, tags: ["medical-specialties"] },
);
