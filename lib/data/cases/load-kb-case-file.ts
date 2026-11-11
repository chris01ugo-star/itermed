import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { knowledgeBaseCaseSchema } from "@/lib/cases/knowledge-base-case-schema";
import { knowledgeBaseCaseToClinicalCase } from "@/lib/data/cases/kb-mapper";
import type { ClinicalCase } from "@/lib/data/cases/types";

export type KbIndex = {
  /** Lookup key → absolute JSON path. Colliding keys are omitted. */
  byKey: Map<string, string>;
  files: string[];
};

let indexPromise: Promise<KbIndex> | null = null;

function knowledgeBaseRoot(): string {
  return resolve(process.cwd(), "knowledge_base");
}

function lookupKeys(raw: string): string[] {
  const trimmed = raw.trim();
  if (trimmed.length < 2) return [];
  const lower = trimmed.toLowerCase().replace(/_/g, "-");
  const bare = lower.replace(/^case-/, "");
  return [...new Set([lower, bare, `case-${bare}`, lower.replace(/-/g, ""), bare.replace(/-/g, "")])];
}

function addKey(index: Map<string, string>, collisions: Set<string>, key: string, file: string) {
  for (const variant of lookupKeys(key)) {
    if (collisions.has(variant)) continue;
    const prev = index.get(variant);
    if (!prev) index.set(variant, file);
    else if (prev !== file) {
      index.delete(variant);
      collisions.add(variant);
    }
  }
}

async function buildKbIndex(): Promise<KbIndex> {
  const byKey = new Map<string, string>();
  const collisions = new Set<string>();
  const files: string[] = [];
  const root = knowledgeBaseRoot();

  let specialties: string[] = [];
  try {
    specialties = await readdir(root);
  } catch {
    return { byKey, files };
  }

  for (const specialty of specialties) {
    const casesDir = join(root, specialty, "cases");
    let names: string[] = [];
    try {
      names = await readdir(casesDir);
    } catch {
      if (specialty !== "tutorials") continue;
      names = await readdir(join(root, specialty)).catch(() => []);
      for (const name of names) {
        if (!name.toLowerCase().endsWith(".json")) continue;
        await indexOne(join(root, specialty, name), name, byKey, collisions, files);
      }
      continue;
    }
    for (const name of names) {
      if (!name.toLowerCase().endsWith(".json") || name.toLowerCase() === "matrix.json") continue;
      await indexOne(join(casesDir, name), name, byKey, collisions, files);
    }
  }

  return { byKey, files };
}

async function indexOne(
  file: string,
  filename: string,
  byKey: Map<string, string>,
  collisions: Set<string>,
  files: string[],
) {
  files.push(file);
  const stem = filename.replace(/\.json$/i, "");
  let data: { id?: unknown; code?: unknown; title?: unknown } = {};
  try {
    data = JSON.parse(await readFile(file, "utf8")) as typeof data;
  } catch {
    addKey(byKey, collisions, stem, file);
    return;
  }
  const id = typeof data.id === "string" ? data.id : "";
  const code = typeof data.code === "string" ? data.code : "";
  const title = typeof data.title === "string" ? data.title : "";
  for (const key of [id, code, stem, title]) addKey(byKey, collisions, key, file);
  if (id) addKey(byKey, collisions, `case-${id.slice(0, 6)}`, file);
}

export function getKnowledgeBaseIndex(): Promise<KbIndex> {
  if (!indexPromise) indexPromise = buildKbIndex();
  return indexPromise;
}

export async function resolveKnowledgeBaseCaseFile(caseId: string): Promise<string | null> {
  const index = await getKnowledgeBaseIndex();
  const trimmed = caseId.trim();
  if (!trimmed) return null;
  for (const key of lookupKeys(trimmed)) {
    const hit = index.byKey.get(key);
    if (hit) return hit;
  }
  return null;
}

/** Read one authored case JSON. Resolves id, code, title, filename, and `CASE-` aliases. */
export async function loadKnowledgeBaseCaseFromDisk(
  caseId: string,
): Promise<ClinicalCase | undefined> {
  const file = await resolveKnowledgeBaseCaseFile(caseId);
  if (!file) return undefined;

  let json: unknown;
  try {
    json = JSON.parse(await readFile(file, "utf8"));
  } catch {
    return undefined;
  }

  const parsed = knowledgeBaseCaseSchema.safeParse(json);
  if (!parsed.success) return undefined;
  return knowledgeBaseCaseToClinicalCase(parsed.data);
}
