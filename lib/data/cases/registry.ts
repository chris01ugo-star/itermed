/**
 * Aequan Case Registry — single source of truth for Prassi Clinica / gold cases.
 * Import this module (not individual specialty files) from app routes & seeds.
 */

import type { ClinicalCaseRow } from "@/components/dashboard/ClinicalCaseCard";
import type { ClinicalCase, CaseCategory, PrassiDifficultyLabel } from "@/lib/data/cases/types";
import { CAR_F01 } from "@/lib/data/cases/cardiologia/car-f01";
import { CAR_F02 } from "@/lib/data/cases/cardiologia/car-f02";
import { CAR_M01 } from "@/lib/data/cases/cardiologia/car-m01";
import { CAR_M02 } from "@/lib/data/cases/cardiologia/car-m02";
import { CAR_M03 } from "@/lib/data/cases/cardiologia/car-m03";
import { CAR_M04 } from "@/lib/data/cases/cardiologia/car-m04";
import { CAR_D01 } from "@/lib/data/cases/cardiologia/car-d01";
import { CAR_D02 } from "@/lib/data/cases/cardiologia/car-d02";
import { CAR_D03 } from "@/lib/data/cases/cardiologia/car-d03";
import { CAR_D04 } from "@/lib/data/cases/cardiologia/car-d04";

/** Shape mirrored by `FallbackClinicalCase` — kept local to avoid circular imports. */
export type RegistryFallbackCase = {
  id: string;
  title: string;
  description: string;
  specialty: string;
  medicalSpecialtyKey: string;
  difficulty: ClinicalCase["difficulty"];
  estimatedDurationMinutes: number;
  timeLimitMinutes: number;
  patientDeteriorationThreshold: number;
  patientPrompt: string;
  pastMedicalHistory: string;
  correctSolution: string;
  goldStandardPath: string[];
  examLatencies: Record<string, number>;
  baselineExamFindings: Record<string, unknown>;
};

/** Canonical ordered registry of authored cases. */
export const CASE_REGISTRY: readonly ClinicalCase[] = Object.freeze([
  CAR_F01,
  CAR_F02,
  CAR_M01,
  CAR_M02,
  CAR_M03,
  CAR_M04,
  CAR_D01,
  CAR_D02,
  CAR_D03,
  CAR_D04,
]);

/** @deprecated Prefer CASE_REGISTRY — alias kept for earlier imports. */
export const GOLD_STANDARD_CASES = CASE_REGISTRY;

/** Normalize ids/codes: trim, lower-case, kebab-case (`CAR_F01` → `car-f01`). */
export function normalizeCaseLookupKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/_/g, "-");
}

function compactCaseKey(raw: string): string {
  return normalizeCaseLookupKey(raw).replace(/-/g, "");
}

/**
 * Resolve a gold-standard case by id or code.
 * Accepts `car-f01`, `CAR-F01`, `car_f01`, `CAR_F01`.
 */
export function getCaseById(codeOrId: string): ClinicalCase | undefined {
  const key = normalizeCaseLookupKey(codeOrId);
  if (!key) return undefined;
  const compact = compactCaseKey(key);

  return CASE_REGISTRY.find((c) => {
    const id = normalizeCaseLookupKey(c.id);
    const code = normalizeCaseLookupKey(c.code);
    return (
      id === key ||
      code === key ||
      compactCaseKey(id) === compact ||
      compactCaseKey(code) === compact
    );
  });
}

export function listRegisteredCases(filters?: {
  category?: CaseCategory;
  specialty?: string;
  difficultyLabel?: PrassiDifficultyLabel;
}): ClinicalCase[] {
  return CASE_REGISTRY.filter((c) => {
    if (filters?.category && c.category !== filters.category) return false;
    if (filters?.specialty && c.specialty.toLowerCase() !== filters.specialty.toLowerCase()) {
      return false;
    }
    if (filters?.difficultyLabel && c.difficultyLabel !== filters.difficultyLabel) return false;
    return true;
  });
}

/** @deprecated Prefer getCaseById */
export const getRegisteredCase = getCaseById;

/** @deprecated Prefer getCaseById */
export const getGoldStandardCase = getCaseById;

/** True when the id belongs to an authored gold-standard registry case. */
export function isRegisteredCaseId(codeOrId: string): boolean {
  return Boolean(getCaseById(codeOrId));
}

/** Adapt ClinicalCase → offline FallbackClinicalCase shape. */
export function toFallbackClinicalCase(c: ClinicalCase): RegistryFallbackCase {
  return {
    id: c.id,
    title: c.title,
    description: c.description,
    specialty: c.specialtyLabel,
    medicalSpecialtyKey: c.medicalSpecialtyKey,
    difficulty: c.difficulty,
    estimatedDurationMinutes: c.estimatedTimeMinutes ?? c.estimatedDurationMinutes,
    timeLimitMinutes: c.timeLimitMinutes,
    patientDeteriorationThreshold: c.patientDeteriorationThreshold,
    patientPrompt: c.patientPrompt,
    pastMedicalHistory: c.pastMedicalHistory,
    correctSolution: c.correctSolution,
    goldStandardPath: c.goldStandardPath,
    examLatencies: c.examLatencies,
    baselineExamFindings: {
      ...c.baselineExamFindings,
      examBudgetEuro:
        (c.baselineExamFindings.examBudgetEuro as number | undefined) ?? c.examBudgetEuro,
      anamnesisQuestions: c.anamnesisQuestions,
      physicalExam: c.physicalExam,
      mandatoryExams: c.mandatoryExams,
      inappropriateExams: c.inappropriateExams,
      legalConformity: c.legalConformity,
    },
  };
}

/** Adapt ClinicalCase → Prassi / dashboard ClinicalCaseRow. */
export function toClinicalCaseRow(
  c: ClinicalCase,
  opts?: { createdById?: string; isGlobal?: boolean },
): ClinicalCaseRow {
  const demographics = c.baselineExamFindings.demographics as
    | { sex?: string | null }
    | undefined;
  return {
    id: c.id,
    title: c.title,
    specialty: c.specialtyLabel,
    difficulty: c.difficulty,
    createdById: opts?.createdById ?? "gold-standard",
    isGlobal: opts?.isGlobal ?? true,
    medicalSpecialty: { name: c.specialtyLabel },
    sex: demographics?.sex ?? null,
  };
}

/**
 * Cases exposed to Prassi Clinica (demo / offline + registry merge).
 * Always includes gold-standard registry entries for the requested section.
 */
export function getPrassiRegistryCaseRows(userId: string): ClinicalCaseRow[] {
  const goldRows = listRegisteredCases({ category: "prassi-clinica" }).map((c) =>
    toClinicalCaseRow(c, { createdById: "gold-standard", isGlobal: true }),
  );

  const legacyDemo: ClinicalCaseRow[] = [
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

  const byId = new Map<string, ClinicalCaseRow>();
  for (const row of [...goldRows, ...legacyDemo]) {
    byId.set(row.id, row);
  }
  return Array.from(byId.values());
}

/** Specialties derived from registry (+ legacy demos) for Prassi filters. */
export function getPrassiRegistrySpecialties(): { id: string; name: string }[] {
  const fromRegistry = listRegisteredCases({ category: "prassi-clinica" }).map((c) => ({
    id: `sp_${c.specialty}`,
    name: c.specialtyLabel,
  }));
  const legacy = [
    { id: "sp_interna", name: "Medicina Interna" },
    { id: "sp_neuro", name: "Neurologia" },
  ];
  const byId = new Map<string, { id: string; name: string }>();
  for (const s of [...fromRegistry, ...legacy]) byId.set(s.id, s);
  return Array.from(byId.values());
}

/** Fallback map keyed by case id / code / underscore aliases for offline simulator lookup. */
export function buildFallbackMapFromRegistry(): Record<string, RegistryFallbackCase> {
  const map: Record<string, RegistryFallbackCase> = {};
  for (const c of CASE_REGISTRY) {
    const fb = toFallbackClinicalCase(c);
    const idKey = normalizeCaseLookupKey(c.id);
    const codeKey = normalizeCaseLookupKey(c.code);
    map[idKey] = fb;
    map[codeKey] = fb;
    map[idKey.replace(/-/g, "_")] = fb;
    map[codeKey.replace(/-/g, "_")] = fb;
    map[c.code] = fb;
    map[c.code.toUpperCase()] = fb;
  }
  return map;
}
