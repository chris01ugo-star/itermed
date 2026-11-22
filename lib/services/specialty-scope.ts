/**
 * Shared corpora live outside a single clinical specialty:
 * - `generale`: Gelli, consenso, codice deontologico, nomenclatore
 * - `empatia`: protocolli di comunicazione
 * Both are stored in Pinecone with metadata.specialty equal to the slug.
 */
export const UNIVERSAL_SPECIALTY = "generale";
export const EMPATHY_SPECIALTY = "empatia";

const SHARED_CORPUS = [UNIVERSAL_SPECIALTY, EMPATHY_SPECIALTY] as const;

export function isSharedCorpusSpecialty(slug: string | null | undefined): boolean {
  const value = (slug ?? "").trim().toLowerCase();
  return (SHARED_CORPUS as readonly string[]).includes(value);
}

/** `generale` and `empatia` are not rows in MedicalSpecialty. */
export function isUniversalSpecialty(slug: string | null | undefined): boolean {
  return isSharedCorpusSpecialty(slug);
}

function addSpecialtyLabel(values: Set<string>, raw: string): void {
  const trimmed = raw.trim();
  if (!trimmed) return;
  values.add(trimmed);
  const lower = trimmed.toLowerCase();
  values.add(lower);
  values.add(lower.charAt(0).toUpperCase() + lower.slice(1));
}

/**
 * Pinecone `{ specialty: { $in } }` values for a case.
 * Always includes `generale` and `empatia`. Optional secondary specialties
 * (comorbidities) are added beside the primary label.
 */
function addResolvedSpecialtyLabel(values: Set<string>, raw: string): void {
  const trimmed = raw.trim();
  if (!trimmed) return;
  const canonical = canonicalSpecialtyName(trimmed);
  if (canonical) addSpecialtyLabel(values, canonical);
  if (!canonical || canonical !== trimmed) addSpecialtyLabel(values, trimmed);
}

export function specialtyScopeValues(
  specialty: string,
  secondarySpecialties: string[] = [],
): string[] {
  const values = new Set<string>();
  addResolvedSpecialtyLabel(values, specialty);
  for (const extra of secondarySpecialties) addResolvedSpecialtyLabel(values, extra);
  for (const shared of SHARED_CORPUS) addSpecialtyLabel(values, shared);
  return [...values];
}

export function pineconeSpecialtyInFilter(
  specialty: string,
  secondarySpecialties: string[] = [],
): { specialty: { $in: string[] } } {
  return { specialty: { $in: specialtyScopeValues(specialty, secondarySpecialties) } };
}

/**
 * Display names stored on `MedicalSpecialty` and on Pinecone `metadata.specialty`
 * for the knowledge-base folders. Matching is case-insensitive and ignores
 * apostrophes, so `medicina d'emergenza-urgenza` resolves to the exact row name.
 */
export const CANONICAL_SPECIALTY_NAMES = [
  "Cardiologia",
  "Ematologia",
  "Gastroenterologia",
  "Geriatria",
  "Malattie Infettive",
  "Medicina Interna",
  "Medicina di Laboratorio",
  "Medicina d'Emergenza-Urgenza",
  "Neurologia",
  "Oncologia",
  "Pneumologia",
  "Psichiatria",
  "Reumatologia",
] as const;

const CASE_ID_SPECIALTY_PREFIXES: ReadonlyArray<readonly [string, string]> = [
  ["CARDIO", "Cardiologia"],
  ["PNEUMO", "Pneumologia"],
  ["GASTRO", "Gastroenterologia"],
  ["INFETT", "Malattie Infettive"],
  ["GERIA", "Geriatria"],
  ["NEURO", "Neurologia"],
  ["PSICH", "Psichiatria"],
  ["REUMA", "Reumatologia"],
  ["EMAT", "Ematologia"],
  ["ONCO", "Oncologia"],
  ["MEU", "Medicina d'Emergenza-Urgenza"],
  ["LAB", "Medicina di Laboratorio"],
  ["MI", "Medicina Interna"],
];

function specialtyAliasKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/['’`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

const SPECIALTY_ALIAS_TO_CANONICAL = new Map<string, string>();

function registerSpecialtyAlias(alias: string, canonical: string): void {
  SPECIALTY_ALIAS_TO_CANONICAL.set(specialtyAliasKey(alias), canonical);
}

for (const name of CANONICAL_SPECIALTY_NAMES) {
  registerSpecialtyAlias(name, name);
  registerSpecialtyAlias(name.replace(/['’]/g, ""), name);
}
registerSpecialtyAlias("cardiologia", "Cardiologia");
registerSpecialtyAlias("cardio", "Cardiologia");
registerSpecialtyAlias("ematologia", "Ematologia");
registerSpecialtyAlias("emat", "Ematologia");
registerSpecialtyAlias("gastroenterologia", "Gastroenterologia");
registerSpecialtyAlias("gastro", "Gastroenterologia");
registerSpecialtyAlias("geriatria", "Geriatria");
registerSpecialtyAlias("geria", "Geriatria");
registerSpecialtyAlias("malattie infettive", "Malattie Infettive");
registerSpecialtyAlias("malattie_infettive", "Malattie Infettive");
registerSpecialtyAlias("infettive", "Malattie Infettive");
registerSpecialtyAlias("infett", "Malattie Infettive");
registerSpecialtyAlias("medicina interna", "Medicina Interna");
registerSpecialtyAlias("medicina_interna", "Medicina Interna");
registerSpecialtyAlias("mi", "Medicina Interna");
registerSpecialtyAlias("medicina di laboratorio", "Medicina di Laboratorio");
registerSpecialtyAlias("medicina_laboratorio", "Medicina di Laboratorio");
registerSpecialtyAlias("laboratorio", "Medicina di Laboratorio");
registerSpecialtyAlias("lab", "Medicina di Laboratorio");
registerSpecialtyAlias("medicina d'emergenza-urgenza", "Medicina d'Emergenza-Urgenza");
registerSpecialtyAlias("medicina d emergenza urgenza", "Medicina d'Emergenza-Urgenza");
registerSpecialtyAlias("medicina_urgenza", "Medicina d'Emergenza-Urgenza");
registerSpecialtyAlias("emergenza_urgenza", "Medicina d'Emergenza-Urgenza");
registerSpecialtyAlias("medicina urgenza", "Medicina d'Emergenza-Urgenza");
registerSpecialtyAlias("emergenza urgenza", "Medicina d'Emergenza-Urgenza");
registerSpecialtyAlias("meu", "Medicina d'Emergenza-Urgenza");
registerSpecialtyAlias("neurologia", "Neurologia");
registerSpecialtyAlias("neuro", "Neurologia");
registerSpecialtyAlias("oncologia", "Oncologia");
registerSpecialtyAlias("onco", "Oncologia");
registerSpecialtyAlias("pneumologia", "Pneumologia");
registerSpecialtyAlias("pneumo", "Pneumologia");
registerSpecialtyAlias("psichiatria", "Psichiatria");
registerSpecialtyAlias("psich", "Psichiatria");
registerSpecialtyAlias("reumatologia", "Reumatologia");
registerSpecialtyAlias("reuma", "Reumatologia");
registerSpecialtyAlias("generale", UNIVERSAL_SPECIALTY);
registerSpecialtyAlias("empatia", EMPATHY_SPECIALTY);

/** Exact `MedicalSpecialty.name`, or the shared slug `generale` / `empatia`. */
export function canonicalSpecialtyName(raw: string | null | undefined): string | undefined {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed) return undefined;
  return SPECIALTY_ALIAS_TO_CANONICAL.get(specialtyAliasKey(trimmed));
}

/** `CARDIO-001` → `Cardiologia`. The prefix must be the whole id or be followed by `-` / `_`. */
export function specialtyNameFromCaseId(caseId: string | null | undefined): string | undefined {
  const id = caseId?.trim().toUpperCase() ?? "";
  if (!id) return undefined;
  const prefixes = [...CASE_ID_SPECIALTY_PREFIXES].sort((a, b) => b[0].length - a[0].length);
  for (const [prefix, name] of prefixes) {
    if (id === prefix || id.startsWith(`${prefix}-`) || id.startsWith(`${prefix}_`)) return name;
  }
  return undefined;
}

/** Title, source path, or filename that is a discarded placeholder document. */
export function isPlaceholderGuidelineLabel(...parts: Array<string | null | undefined>): boolean {
  return parts.some((part) => typeof part === "string" && /placeholder/i.test(part));
}

/** `placeholder.md` / `Placeholder.PDF`, not a real file that merely mentions the word. */
export function isPlaceholderFilename(filename: string): boolean {
  const base = filename.replace(/\\/g, "/").split("/").pop() ?? filename;
  const stem = base.replace(/\.[^.]+$/, "");
  return stem.toLowerCase() === "placeholder";
}

/** Reads `secondarySpecialties` or `secondary_specialties` from a case payload. */
export function readSecondarySpecialties(source: unknown): string[] {
  if (!source || typeof source !== "object") return [];
  const record = source as Record<string, unknown>;
  const raw = record.secondarySpecialties ?? record.secondary_specialties;
  if (!Array.isArray(raw)) return [];

  const seen = new Set<string>();
  const values: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    values.push(trimmed);
  }
  return values;
}
