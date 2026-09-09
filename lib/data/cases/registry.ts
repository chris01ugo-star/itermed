/**
 * Aequan Case Registry — single source of truth for Prassi Clinica / gold cases.
 * Knowledge-base cases (CARDIO/PNEUMO/GASTRO) are read from PostgreSQL.
 * Import this module (not individual specialty JSON files) from app routes & seeds.
 *
 * Process-level in-memory catalog (O(1) after first Prisma load) + React `cache()`
 * for per-request dedup. Invalidate with `clearCasesCache()` after authoring writes.
 */

import "server-only";

import { cache } from "react";
import { config, isUsableDatabase } from "@/lib/config";
import { KnowledgeBaseCaseValidationError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { clinicalCaseFromKnowledgeBaseRow } from "@/lib/data/cases/kb-mapper";
import type { ClinicalCaseRow } from "@/components/dashboard/ClinicalCaseCard";
import type { ClinicalCase, CaseCategory, PrassiDifficultyLabel } from "@/lib/data/cases/types";
import {
  AUTHORED_CASE_REGISTRY,
  CASE_REGISTRY,
  GOLD_STANDARD_CASES,
  buildAuthoredFallbackMap,
  buildFallbackMapFromRegistry,
  clearCasesCache,
  decodeCaseParam,
  filterRegisteredCases,
  findAuthoredCase,
  getCachedCaseById,
  getCachedKbCatalog,
  isKbCatalogLoaded,
  isRegisteredCaseId,
  knowledgeBaseIdCandidates,
  listCachedRegisteredCases,
  normalizeCaseLookupKey,
  rememberKbCase,
  setKbCatalog,
  toClinicalCaseRow,
  toFallbackClinicalCase,
  type RegistryFallbackCase,
} from "@/lib/data/cases/registry-store";

export type { RegistryFallbackCase };
export {
  AUTHORED_CASE_REGISTRY,
  CASE_REGISTRY,
  GOLD_STANDARD_CASES,
  buildAuthoredFallbackMap,
  buildFallbackMapFromRegistry,
  clearCasesCache,
  decodeCaseParam,
  getCachedCaseById,
  isRegisteredCaseId,
  normalizeCaseLookupKey,
  toClinicalCaseRow,
  toFallbackClinicalCase,
};

async function loadKbCasesFromDb(): Promise<ClinicalCase[]> {
  if (!isUsableDatabase(config.DATABASE_URL)) return [];

  try {
    const rows = await prisma.knowledgeBaseCase.findMany({
      orderBy: [{ specialty: "asc" }, { id: "asc" }],
    });
    const mapped = rows.map((row) =>
      clinicalCaseFromKnowledgeBaseRow({
        id: row.id,
        caseData: row.caseData,
        patientProfile: row.patientProfile,
        ragSources: row.ragSources,
      }),
    );
    setKbCatalog(mapped);
    return mapped;
  } catch (err) {
    if (err instanceof KnowledgeBaseCaseValidationError) throw err;
    console.error("[registry] loadKbCasesFromDb failed", err);
    return [];
  }
}

/** Warm the process catalog from PostgreSQL once; subsequent calls are O(1) RAM. */
async function ensureKbCatalogLoaded(): Promise<ClinicalCase[]> {
  const cached = getCachedKbCatalog();
  if (cached) return cached;
  return loadKbCasesFromDb();
}

async function getCaseRegistryImpl(): Promise<ClinicalCase[]> {
  const kb = await ensureKbCatalogLoaded();
  return [...AUTHORED_CASE_REGISTRY, ...kb];
}

/** Request-deduped catalog. Process cache serves RAM after the first Prisma read. */
export const getCaseRegistry = cache(getCaseRegistryImpl);

async function loadKbCaseByIdFromDb(codeOrId: string): Promise<ClinicalCase | undefined> {
  if (!isUsableDatabase(config.DATABASE_URL)) return undefined;
  const candidates = knowledgeBaseIdCandidates(codeOrId);
  if (candidates.length === 0) return undefined;

  try {
    const row = await prisma.knowledgeBaseCase.findFirst({
      where: { id: { in: candidates } },
    });
    if (!row) return undefined;
    const mapped = clinicalCaseFromKnowledgeBaseRow({
      id: row.id,
      caseData: row.caseData,
      patientProfile: row.patientProfile,
      ragSources: row.ragSources,
    });
    rememberKbCase(mapped);
    return mapped;
  } catch (err) {
    if (err instanceof KnowledgeBaseCaseValidationError) throw err;
    console.error("[registry] loadKbCaseByIdFromDb failed", codeOrId, err);
    return undefined;
  }
}

async function getCaseByIdImpl(codeOrId: string): Promise<ClinicalCase | undefined> {
  const authored = findAuthoredCase(codeOrId);
  if (authored) return authored;

  const cached = getCachedCaseById(codeOrId);
  if (cached) return cached;

  const fromDb = await loadKbCaseByIdFromDb(codeOrId);
  if (fromDb) return fromDb;

  if (!isKbCatalogLoaded() && isUsableDatabase(config.DATABASE_URL)) {
    await ensureKbCatalogLoaded();
    return getCachedCaseById(codeOrId);
  }

  return undefined;
}

/**
 * Resolve a gold-standard case by id or code (O(1) after catalog warm).
 * Accepts `car-f01`, `CAR-F01`, `GASTRO-001`, `gastro-001`.
 */
export const getCaseById = cache(getCaseByIdImpl);

async function listRegisteredCasesImpl(filters?: {
  category?: CaseCategory;
  specialty?: string;
  difficultyLabel?: PrassiDifficultyLabel;
}): Promise<ClinicalCase[]> {
  const all = await getCaseRegistry();
  return filterRegisteredCases(all, filters);
}

export const listRegisteredCases = cache(listRegisteredCasesImpl);

/** @deprecated Prefer getCaseById */
export const getRegisteredCase = getCaseById;

/** @deprecated Prefer getCaseById */
export const getGoldStandardCase = getCaseById;

/**
 * Cases exposed to Prassi Clinica (demo / offline + registry merge).
 * Always includes gold-standard registry entries for the requested section.
 */
export async function getPrassiRegistryCaseRows(userId: string): Promise<ClinicalCaseRow[]> {
  const goldRows = (await listRegisteredCases({ category: "prassi-clinica" })).map((c) =>
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
      title: "Uomo 33 anni con cefalea acuta e nausea",
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
export async function getPrassiRegistrySpecialties(): Promise<{ id: string; name: string }[]> {
  const fromRegistry = (await listRegisteredCases({ category: "prassi-clinica" })).map((c) => ({
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

/** Hydrate the in-memory KB cache (used by sync evaluation fallbacks). */
export async function hydrateRegisteredCaseCache(codeOrId?: string): Promise<void> {
  if (codeOrId) {
    await getCaseById(codeOrId);
    return;
  }
  await ensureKbCatalogLoaded();
}

export { knowledgeBaseIdCandidates, listCachedRegisteredCases };
