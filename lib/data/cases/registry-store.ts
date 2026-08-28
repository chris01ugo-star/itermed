/**
 * Client-safe registry primitives: authored TypeScript cases + in-memory KB cache.
 * Prisma I/O lives in `registry.ts` (server-only) so the client bundle stays Prisma-free.
 */

import { z } from "zod";
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

/** Authored TypeScript cases (not JSON). KB cases are loaded from PostgreSQL. */
export const AUTHORED_CASE_REGISTRY: readonly ClinicalCase[] = Object.freeze([
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

/**
 * @deprecated Sync authored-only subset. Use `getCaseRegistry()` for the full catalog
 * (authored + knowledge-base rows from PostgreSQL).
 */
export const CASE_REGISTRY = AUTHORED_CASE_REGISTRY;

/** @deprecated Prefer getCaseRegistry() — alias kept for earlier imports. */
export const GOLD_STANDARD_CASES = CASE_REGISTRY;

const KB_CASE_ID_RE = /^(cardio|pneumo|gastro)-\d{3}$/i;

const DemographicsViewSchema = z
  .object({
    sex: z.union([z.string(), z.null()]).optional(),
    age: z.union([z.number(), z.string(), z.null()]).optional(),
  })
  .passthrough();

type KbCacheState = {
  /** True once the full KnowledgeBaseCase catalog has been loaded from PostgreSQL. */
  loaded: boolean;
  list: ClinicalCase[];
  byId: Map<string, ClinicalCase>;
};

const globalForKb = globalThis as unknown as {
  aequanKbCaseCache?: KbCacheState;
};

function kbCache(): KbCacheState {
  if (!globalForKb.aequanKbCaseCache) {
    globalForKb.aequanKbCaseCache = {
      loaded: false,
      list: [],
      byId: new Map(),
    };
  }
  return globalForKb.aequanKbCaseCache;
}

function indexCaseKeys(c: ClinicalCase): string[] {
  return [...knowledgeBaseIdCandidates(c.id), ...knowledgeBaseIdCandidates(c.code)];
}

/** Normalize ids/codes: trim, lower-case, kebab-case (`CAR_F01` → `car-f01`). */
export function normalizeCaseLookupKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/_/g, "-");
}

export function compactCaseKey(raw: string): string {
  return normalizeCaseLookupKey(raw).replace(/-/g, "");
}

/** Decode a dynamic-route param (`GASTRO-001`, URL-encoded, UUID/cuid). */
export function decodeCaseParam(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  try {
    return decodeURIComponent(trimmed);
  } catch {
    return trimmed;
  }
}

export function knowledgeBaseIdCandidates(codeOrId: string): string[] {
  const trimmed = decodeCaseParam(codeOrId);
  if (!trimmed) return [];
  const kebab = trimmed.replace(/_/g, "-");
  const normalized = normalizeCaseLookupKey(trimmed);
  return [
    ...new Set(
      [
        trimmed,
        kebab,
        kebab.toUpperCase(),
        kebab.toLowerCase(),
        normalized,
        normalized.toUpperCase(),
        trimmed.toUpperCase(),
        trimmed.toLowerCase(),
      ].filter((value) => value.length > 0),
    ),
  ];
}

function caseMatchesLookup(c: ClinicalCase, key: string, compact: string): boolean {
  const id = normalizeCaseLookupKey(c.id);
  const code = normalizeCaseLookupKey(c.code);
  return (
    id === key ||
    code === key ||
    compactCaseKey(id) === compact ||
    compactCaseKey(code) === compact
  );
}

export function findAuthoredCase(codeOrId: string): ClinicalCase | undefined {
  const key = normalizeCaseLookupKey(codeOrId);
  if (!key) return undefined;
  const compact = compactCaseKey(key);
  return AUTHORED_CASE_REGISTRY.find((c) => caseMatchesLookup(c, key, compact));
}

export function rememberKbCase(c: ClinicalCase): void {
  const cache = kbCache();
  for (const key of indexCaseKeys(c)) {
    cache.byId.set(key, c);
  }
}

export function rememberKbCases(cases: ClinicalCase[]): void {
  for (const c of cases) rememberKbCase(c);
}

/** Replace the in-memory catalog after a full PostgreSQL load. */
export function setKbCatalog(cases: ClinicalCase[]): void {
  const cache = kbCache();
  cache.byId.clear();
  cache.list = cases;
  cache.loaded = true;
  rememberKbCases(cases);
}

export function isKbCatalogLoaded(): boolean {
  return kbCache().loaded;
}

/** Full KB list when the catalog is warm; otherwise `null` (caller must hit Prisma). */
export function getCachedKbCatalog(): ClinicalCase[] | null {
  const cache = kbCache();
  return cache.loaded ? cache.list : null;
}

/**
 * Drop the process-level KB catalog. Call after generate/update of KnowledgeBaseCase rows
 * so the next read reloads from PostgreSQL.
 */
export function clearCasesCache(): void {
  const cache = kbCache();
  cache.loaded = false;
  cache.list = [];
  cache.byId.clear();
}

/** Sync lookup: authored TypeScript cases + KB rows already hydrated from Prisma. */
export function getCachedCaseById(codeOrId: string): ClinicalCase | undefined {
  const authored = findAuthoredCase(codeOrId);
  if (authored) return authored;
  const cache = kbCache();
  for (const key of knowledgeBaseIdCandidates(codeOrId)) {
    const hit = cache.byId.get(key);
    if (hit) return hit;
  }
  return undefined;
}

export function listCachedRegisteredCases(filters?: {
  category?: CaseCategory;
  specialty?: string;
  difficultyLabel?: PrassiDifficultyLabel;
}): ClinicalCase[] {
  const cache = kbCache();
  const kbUnique = new Map<string, ClinicalCase>();
  for (const c of cache.byId.values()) kbUnique.set(c.id, c);
  const all = [...AUTHORED_CASE_REGISTRY, ...kbUnique.values()];
  return all.filter((c) => {
    if (filters?.category && c.category !== filters.category) return false;
    if (filters?.specialty && c.specialty.toLowerCase() !== filters.specialty.toLowerCase()) {
      return false;
    }
    if (filters?.difficultyLabel && c.difficultyLabel !== filters.difficultyLabel) return false;
    return true;
  });
}

/** True when the id belongs to an authored gold-standard registry case. */
export function isRegisteredCaseId(codeOrId: string): boolean {
  if (findAuthoredCase(codeOrId)) return true;
  return KB_CASE_ID_RE.test(normalizeCaseLookupKey(codeOrId));
}

/** Adapt ClinicalCase → offline FallbackClinicalCase shape. */
export function toFallbackClinicalCase(c: ClinicalCase): RegistryFallbackCase {
  const budgetRaw = c.baselineExamFindings.examBudgetEuro;
  const examBudgetEuro = typeof budgetRaw === "number" && Number.isFinite(budgetRaw) ? budgetRaw : c.examBudgetEuro;
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
      examBudgetEuro,
      physicalExam: c.physicalExam,
    },
  };
}

function readDemographics(baseline: Record<string, unknown>): {
  sex: string | null;
  age: number | null;
} {
  const parsed = DemographicsViewSchema.safeParse(baseline.demographics);
  if (!parsed.success) return { sex: null, age: null };
  const ageNum = Number(parsed.data.age);
  return {
    sex: parsed.data.sex ?? null,
    age: Number.isFinite(ageNum) && ageNum >= 1 && ageNum <= 120 ? Math.round(ageNum) : null,
  };
}

/** Adapt ClinicalCase → Prassi / dashboard ClinicalCaseRow. */
export function toClinicalCaseRow(
  c: ClinicalCase,
  opts?: { createdById?: string; isGlobal?: boolean },
): ClinicalCaseRow {
  const demographics = readDemographics(c.baselineExamFindings);
  return {
    id: c.id,
    title: c.title,
    specialty: c.specialtyLabel,
    difficulty: c.difficulty,
    createdById: opts?.createdById ?? "gold-standard",
    isGlobal: opts?.isGlobal ?? true,
    medicalSpecialty: { name: c.specialtyLabel },
    sex: demographics.sex,
    age: demographics.age,
  };
}

function matchesFilters(
  c: ClinicalCase,
  filters?: {
    category?: CaseCategory;
    specialty?: string;
    difficultyLabel?: PrassiDifficultyLabel;
  },
): boolean {
  if (filters?.category && c.category !== filters.category) return false;
  if (filters?.specialty && c.specialty.toLowerCase() !== filters.specialty.toLowerCase()) {
    return false;
  }
  if (filters?.difficultyLabel && c.difficultyLabel !== filters.difficultyLabel) return false;
  return true;
}

export function filterRegisteredCases(
  cases: readonly ClinicalCase[],
  filters?: {
    category?: CaseCategory;
    specialty?: string;
    difficultyLabel?: PrassiDifficultyLabel;
  },
): ClinicalCase[] {
  return cases.filter((c) => matchesFilters(c, filters));
}

/** Fallback map keyed by case id / code / underscore aliases (authored subset). */
export function buildAuthoredFallbackMap(): Record<string, RegistryFallbackCase> {
  const map: Record<string, RegistryFallbackCase> = {};
  for (const c of AUTHORED_CASE_REGISTRY) {
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

/** @deprecated Prefer buildAuthoredFallbackMap + async KB lookup. */
export function buildFallbackMapFromRegistry(): Record<string, RegistryFallbackCase> {
  return buildAuthoredFallbackMap();
}
